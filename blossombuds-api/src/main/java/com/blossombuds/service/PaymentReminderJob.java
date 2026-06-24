package com.blossombuds.service;

import com.blossombuds.domain.CheckoutIntent;
import com.blossombuds.domain.CustomerWhatsAppPreference;
import com.blossombuds.repository.CheckoutIntentRepository;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.repository.CustomerWhatsAppPreferenceRepository;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Scheduled job that detects abandoned Razorpay checkouts and sends payment reminders
 * via WhatsApp, Email, and SMS. Controlled by the 'whatsapp.payment_reminder.enabled'
 * settings flag; safe to leave on — will no-op when flag is false.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentReminderJob {

    private static final int MAX_REMINDERS = 2;
    private static final int COOLDOWN_HOURS = 6;
    private static final int MAX_AGE_HOURS = 48;
    private static final int BATCH_SIZE = 50;

    private final CheckoutIntentRepository checkoutIntentRepository;
    private final CustomerRepository customerRepository;
    private final CustomerWhatsAppPreferenceRepository preferenceRepository;
    private final WhatsAppCloudClient whatsAppCloudClient;
    private final EmailService emailService;
    private final SettingsService settingsService;
    private final ObjectMapper objectMapper;

    // Prevents re-entry within a single JVM instance; rotate credentials if multi-instance
    private final AtomicBoolean jobRunning = new AtomicBoolean(false);

    @Value("${app.frontend.baseUrl:}")
    private String frontendBase;

    /** Runs every 15 minutes; initial delay 3 minutes to let the app fully start. */
    @Scheduled(fixedDelay = 15 * 60 * 1000, initialDelay = 3 * 60 * 1000)
    public void sendPaymentReminders() {
        if (!isEnabled()) {
            log.debug("[PAYMENT_REMINDER][SKIP] Feature disabled via settings");
            return;
        }

        if (!jobRunning.compareAndSet(false, true)) {
            log.warn("[PAYMENT_REMINDER][SKIP] Previous run still active, skipping this tick");
            return;
        }

        try {
            int delayMinutes = intSetting("whatsapp.payment_reminder.delay_minutes", 30);
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime maxCreatedAt = now.minusMinutes(delayMinutes);
            LocalDateTime minCreatedAt = now.minusHours(MAX_AGE_HOURS);
            LocalDateTime cooldownBefore = now.minusHours(COOLDOWN_HOURS);

            List<CheckoutIntent> eligible = checkoutIntentRepository.findEligibleForReminder(
                    minCreatedAt, maxCreatedAt, MAX_REMINDERS, cooldownBefore,
                    PageRequest.of(0, BATCH_SIZE)
            );

            if (eligible.isEmpty()) {
                log.debug("[PAYMENT_REMINDER] No eligible intents found");
                return;
            }

            log.info("[PAYMENT_REMINDER][START] Processing {} abandoned checkout intent(s)", eligible.size());

            int sent = 0;
            int failed = 0;

            for (CheckoutIntent intent : eligible) {
                try {
                    processIntent(intent);
                    sent++;
                } catch (Exception e) {
                    log.error("[PAYMENT_REMINDER][ERROR] intentId={} error={}", intent.getId(), e.getMessage(), e);
                    failed++;
                }
            }

            log.info("[PAYMENT_REMINDER][DONE] sent={} failed={}", sent, failed);
        } finally {
            jobRunning.set(false);
        }
    }

    /**
     * Processes one intent: saves the reminder counter FIRST (so a failed send
     * does not re-queue the intent), then sends each channel independently.
     * No @Transactional — each repository call runs in its own auto-committed
     * transaction so the DB connection is not held across the external HTTP calls.
     */
    public void processIntent(CheckoutIntent intent) {
        OrderDraftSummary draft = parseDraft(intent.getOrderDraftJson());
        if (draft == null) {
            log.warn("[PAYMENT_REMINDER][SKIP] Could not parse orderDraftJson for intentId={}", intent.getId());
            return;
        }

        String customerName = safeName(draft.getShipName());
        String paymentLink = buildCartUrl();
        String orderRef = shortRef(intent.getRzpOrderId());

        // Fetch customer email, account phone, and WhatsApp opt-in preference
        String email = null;
        String accountPhone = null;
        CustomerWhatsAppPreference pref = null;
        if (intent.getCustomerId() != null) {
            var customer = customerRepository.findById(intent.getCustomerId()).orElse(null);
            email = customer != null ? customer.getEmail() : null;
            accountPhone = customer != null ? customer.getPhone() : null;
            pref = preferenceRepository.findByCustomerId(intent.getCustomerId()).orElse(null);
        }
        // Use the account phone for WhatsApp — it's the number the opt-in is tied to.
        // Fall back to the shipping phone only for guest checkouts (no customerId).
        String phone = normalizePhone(!isBlank(accountPhone) ? accountPhone : draft.getShipPhone());

        boolean willSendWhatsApp = !isBlank(phone) && isWhatsAppOptedIn(pref);
        boolean willSendEmail    = !isBlank(email);

        log.info("[PAYMENT_REMINDER][SEND] intentId={} orderRef='{}' whatsapp={} email={}",
                intent.getId(), orderRef, willSendWhatsApp, willSendEmail);

        if (!willSendWhatsApp && !willSendEmail) {
            log.info("[PAYMENT_REMINDER][SKIP] No sendable channel for intentId={}, not consuming reminder slot",
                    intent.getId());
            return;
        }

        // Persist the incremented counter BEFORE sending so a send-side failure
        // does not re-queue the same intent on the next job tick.
        int count = intent.getReminderCount() == null ? 0 : intent.getReminderCount();
        intent.setReminderCount(count + 1);
        intent.setReminderSentAt(LocalDateTime.now());
        checkoutIntentRepository.save(intent);

        // WhatsApp: only if customer has actively opted in
        if (willSendWhatsApp) {
            try {
                whatsAppCloudClient.sendTemplateMessage(
                        phone, "payment_pending_reminder", "en",
                        List.of(customerName, orderRef, paymentLink));
            } catch (Exception e) {
                log.error("[PAYMENT_REMINDER][WHATSAPP_FAIL] intentId={}: {}", intent.getId(), e.getMessage());
            }
        }

        // Email
        if (willSendEmail) {
            try {
                emailService.sendPaymentPendingReminder(
                        email, customerName, orderRef,
                        draft.getGrandTotal(), draft.getCurrency(), paymentLink);
            } catch (Exception e) {
                log.error("[PAYMENT_REMINDER][EMAIL_FAIL] intentId={}: {}", intent.getId(), e.getMessage());
            }
        }

    }

    private boolean isWhatsAppOptedIn(CustomerWhatsAppPreference pref) {
        return pref != null && Boolean.TRUE.equals(pref.getOptedIn()) && Boolean.TRUE.equals(pref.getActive());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private OrderDraftSummary parseDraft(String json) {
        if (isBlank(json)) return null;
        try {
            return objectMapper.readValue(json, OrderDraftSummary.class);
        } catch (Exception e) {
            log.warn("[PAYMENT_REMINDER][PARSE_FAIL] {}", e.getMessage());
            return null;
        }
    }

    private String buildCartUrl() {
        String base = (frontendBase == null) ? "" : frontendBase.trim();
        if (base.isEmpty()) return "/cart";
        if (!base.startsWith("http")) base = "https://" + base;
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base + "/cart";
    }

    /** Returns a short, customer-friendly order reference from the Razorpay order id. */
    private String shortRef(String rzpOrderId) {
        if (isBlank(rzpOrderId)) return "your recent order";
        // rzpOrderId looks like "order_PQJdlIHUBzXa3X" — use last 8 chars as a short code
        String clean = rzpOrderId.startsWith("order_") ? rzpOrderId.substring(6) : rzpOrderId;
        return clean.length() > 8 ? clean.substring(clean.length() - 8).toUpperCase() : clean.toUpperCase();
    }

    private String normalizePhone(String phone) {
        if (phone == null) return "";
        String digits = phone.replaceAll("[^0-9]", "");
        if (digits.length() == 10) return "+91" + digits;
        if (digits.length() == 12 && digits.startsWith("91")) return "+" + digits;
        if (digits.length() == 14 && digits.startsWith("0091")) return "+" + digits.substring(2);
        return digits.isEmpty() ? "" : "+" + digits;
    }

    private String safeName(String name) {
        return (name == null || name.isBlank()) ? "Customer" : name.trim();
    }

    private boolean isEnabled() {
        try {
            var s = settingsService.get("whatsapp.payment_reminder.enabled");
            return s != null && "true".equalsIgnoreCase(s.getValue());
        } catch (Exception e) {
            return false;
        }
    }

    private int intSetting(String key, int defaultValue) {
        try {
            var s = settingsService.get(key);
            if (s == null || isBlank(s.getValue())) return defaultValue;
            return Integer.parseInt(s.getValue().trim());
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /** Minimal projection of OrderDto for parsing the stored checkout draft JSON. */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OrderDraftSummary {
        private Long customerId;
        private String shipName;
        private String shipPhone;
        private BigDecimal grandTotal;
        private String currency;
    }
}
