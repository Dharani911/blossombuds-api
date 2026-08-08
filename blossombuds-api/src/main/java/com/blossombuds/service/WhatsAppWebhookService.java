package com.blossombuds.service;

import com.blossombuds.domain.Setting;
import com.blossombuds.domain.WhatsAppContact;
import com.blossombuds.domain.WhatsAppMessageEvent;
import com.blossombuds.repository.CustomerWhatsAppPreferenceRepository;
import com.blossombuds.repository.WhatsAppCampaignRecipientRepository;
import com.blossombuds.repository.WhatsAppCampaignRepository;
import com.blossombuds.repository.WhatsAppContactRepository;
import com.blossombuds.repository.WhatsAppMessageEventRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;

/** Service for processing Meta WhatsApp Cloud API webhook payloads. */
@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppWebhookService {

    private static final java.util.concurrent.ConcurrentHashMap<String, Long> AUTO_REPLY_LAST_SENT
            = new java.util.concurrent.ConcurrentHashMap<>();
    private static final long AUTO_REPLY_COOLDOWN_MS = 5 * 60 * 1000L;

    private final ObjectMapper objectMapper;
    private final WhatsAppMessageEventRepository messageEventRepository;
    private final WhatsAppCampaignRecipientRepository recipientRepository;
    private final WhatsAppCampaignRepository campaignRepository;
    private final WhatsAppCloudClient whatsAppCloudClient;
    private final SettingsService settingsService;
    private final CustomerWhatsAppPreferenceRepository preferenceRepository;
    private final WhatsAppContactRepository whatsAppContactRepository;

    /** Stores and processes a raw WhatsApp webhook payload. */
    @Transactional
    public void processWebhookPayload(String rawPayload) {
        if (rawPayload == null || rawPayload.isBlank()) {
            log.warn("[WHATSAPP][WEBHOOK] Empty payload received");
            return;
        }

        WhatsAppMessageEvent rawEvent = new WhatsAppMessageEvent();
        rawEvent.setEventType("RAW_WEBHOOK");
        rawEvent.setRawPayload(rawPayload);
        rawEvent.setReceivedAt(OffsetDateTime.now());
        rawEvent.setCreatedAt(OffsetDateTime.now());
        messageEventRepository.save(rawEvent);

        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            JsonNode entries = root.path("entry");

            if (!entries.isArray()) {
                log.debug("[WHATSAPP][WEBHOOK] No entry array found");
                return;
            }

            for (JsonNode entry : entries) {
                JsonNode changes = entry.path("changes");

                if (!changes.isArray()) {
                    continue;
                }

                for (JsonNode change : changes) {
                    JsonNode value = change.path("value");
                    processStatuses(value);
                    processIncomingMessages(value, rawPayload);
                }
            }
        } catch (Exception e) {
            log.error("[WHATSAPP][WEBHOOK] Failed to process payload: {}", e.getMessage(), e);
        }
    }

    /** Processes message status updates such as sent, delivered, read, or failed. */
    private void processStatuses(JsonNode value) {
        JsonNode statuses = value.path("statuses");

        if (!statuses.isArray()) {
            return;
        }

        for (JsonNode statusNode : statuses) {
            String providerMessageId = text(statusNode, "id");
            String providerStatus = text(statusNode, "status");
            String phone = text(statusNode, "recipient_id");

            String errorCode = "";
            String errorMessage = "";

            JsonNode errors = statusNode.path("errors");
            if (errors.isArray() && !errors.isEmpty()) {
                JsonNode firstError = errors.get(0);
                errorCode = text(firstError, "code");
                errorMessage = text(firstError, "message");
            }

            WhatsAppMessageEvent event = new WhatsAppMessageEvent();
            event.setProviderMessageId(providerMessageId);
            event.setPhone(phone);
            event.setEventType("STATUS");
            event.setProviderStatus(providerStatus);
            event.setErrorCode(errorCode);
            event.setErrorMessage(errorMessage);
            event.setRawPayload(statusNode.toString());
            event.setReceivedAt(OffsetDateTime.now());
            event.setCreatedAt(OffsetDateTime.now());
            messageEventRepository.save(event);

            log.info("[WHATSAPP][WEBHOOK][STATUS_EVENT] wamid={} recipient={} status={} errorCode={} errorMessage={}",
                    providerMessageId, maskPhone(phone), providerStatus, errorCode, errorMessage);

            updateRecipientStatus(providerMessageId, providerStatus, errorMessage);
        }
    }

    /** Stores incoming customer messages for future opt-out or reply handling. */
    private void processIncomingMessages(JsonNode value, String rawPayload) {
        JsonNode messages = value.path("messages");

        if (!messages.isArray()) {
            return;
        }

        for (JsonNode messageNode : messages) {
            String providerMessageId = text(messageNode, "id");
            String phone = text(messageNode, "from");
            String messageType = text(messageNode, "type");

            WhatsAppMessageEvent event = new WhatsAppMessageEvent();
            event.setProviderMessageId(providerMessageId);
            event.setPhone(phone);
            event.setEventType("INCOMING_MESSAGE");
            event.setProviderStatus(messageType);
            event.setRawPayload(messageNode.toString());
            event.setReceivedAt(OffsetDateTime.now());
            event.setCreatedAt(OffsetDateTime.now());
            messageEventRepository.save(event);

            log.info("[WHATSAPP][WEBHOOK][MESSAGE] Incoming message received from phone={}, type={}",
                    maskPhone(phone), messageType);

            String bodyText = messageNode.path("text").path("body").asText("").trim();
            if ("STOP".equalsIgnoreCase(bodyText)) {
                handleStop(phone);
            } else {
                // Record the interaction before replying. This is what makes the contact reachable
                // by a future marketing campaign — see captureInboundContact.
                boolean justOptedIn = captureInboundContact(phone, profileNameFor(value, phone), bodyText);
                sendAutoReply(phone, justOptedIn);
            }
        }
    }

    /**
     * Meta sends the sender's WhatsApp display name in a `contacts` array alongside `messages`,
     * keyed by wa_id. Returns "" when absent — the name is a nicety, never required.
     */
    private String profileNameFor(JsonNode value, String phone) {
        JsonNode contacts = value.path("contacts");
        if (!contacts.isArray() || phone == null) return "";
        for (JsonNode contact : contacts) {
            if (phone.equals(text(contact, "wa_id"))) {
                return contact.path("profile").path("name").asText("").trim();
            }
        }
        return "";
    }

    /**
     * Creates or refreshes a whatsapp_contacts row for anyone who messages the business number.
     *
     * This is the capture half of the expo QR flow: a lead scans the code, WhatsApp opens with the
     * opt-in sentence pre-filled, they send it, and they land here — phone, display name and an
     * inbound timestamp, with no manual list to type up afterwards.
     *
     * Stamping lastInboundAt is the important part. Meta drops MARKETING templates to recipients
     * who have never interacted with the sending number (131049), so this timestamp is what
     * distinguishes a contact a campaign can actually reach from one it cannot.
     *
     * Opt-in is deliberately conservative: messaging a business is consent to be *replied to*, not
     * blanket consent to marketing. A contact is only opted in when the message matches the opt-in
     * phrase from the QR link (configurable via the whatsapp.optin.phrase setting). Anyone else —
     * a support question, say — is recorded as reachable but left opted out, and an existing
     * opt-out is never silently reversed.
     *
     * @return true when this message just opted the contact in for the first time — the caller
     *         uses it to send a welcome rather than the standard "this number is send-only" reply.
     */
    private boolean captureInboundContact(String phone, String profileName, String bodyText) {
        if (phone == null || phone.isBlank()) return false;

        String e164 = phone.startsWith("+") ? phone : "+" + phone.replaceAll("[^0-9]", "");
        OffsetDateTime now = OffsetDateTime.now();
        boolean isOptInMessage = matchesOptInPhrase(bodyText);

        boolean justOptedIn = false;

        try {
            // A registered customer is tracked through their preference row, not the expo contacts
            // table. Stamp it so the ALL_OPTED_IN audience can tell reachable customers from the
            // rest, and return early — creating a whatsapp_contacts row for someone who already
            // has an account would only produce a duplicate the expo audience then has to skip.
            var preference = preferenceRepository.findByPhoneAndActiveTrue(e164)
                    .or(() -> preferenceRepository.findByPhoneAndActiveTrue(e164.substring(1)));
            if (preference.isPresent()) {
                var pref = preference.get();
                pref.setLastInboundAt(now);
                pref.setModifiedBy("webhook-inbound");
                pref.setModifiedAt(now);
                preferenceRepository.save(pref);
                log.info("[WHATSAPP][INBOUND][CAPTURE] Marked registered customer reachable phone={}",
                        maskPhone(phone));
                return false; // already a customer — no welcome, they did not just opt in here
            }

            WhatsAppContact contact = whatsAppContactRepository.findByPhone(e164)
                    .or(() -> whatsAppContactRepository.findByPhone(e164.substring(1)))
                    .orElse(null);

            if (contact == null) {
                contact = new WhatsAppContact();
                contact.setPhone(e164);
                contact.setSource("WHATSAPP_INBOUND");
                contact.setOptedIn(isOptInMessage);
                contact.setActive(Boolean.TRUE);
                contact.setCreatedBy("webhook-inbound");
                contact.setCreatedAt(now);
                if (!profileName.isBlank()) contact.setName(profileName);
                justOptedIn = isOptInMessage;
                log.info("[WHATSAPP][INBOUND][CAPTURE] New contact from inbound message phone={} optedIn={}",
                        maskPhone(phone), isOptInMessage);
            } else {
                // Fill in a name we never had, but never overwrite one an admin curated.
                if (!profileName.isBlank() && (contact.getName() == null || contact.getName().isBlank())) {
                    contact.setName(profileName);
                }
                // Re-opt-in only on an explicit opt-in message, so a STOP is not undone by a
                // subsequent "where is my order?".
                if (isOptInMessage && !Boolean.TRUE.equals(contact.getOptedIn())) {
                    contact.setOptedIn(Boolean.TRUE);
                    contact.setActive(Boolean.TRUE);
                    contact.setOptedOutAt(null);
                    justOptedIn = true;
                    log.info("[WHATSAPP][INBOUND][OPT_IN] Contact re-opted in via inbound phrase phone={}",
                            maskPhone(phone));
                }
            }

            contact.setLastInboundAt(now);
            contact.setModifiedBy("webhook-inbound");
            contact.setModifiedAt(now);
            whatsAppContactRepository.save(contact);
            return justOptedIn;
        } catch (Exception e) {
            // Never let contact capture break webhook processing — the delivery-status half of
            // this webhook matters more than the bookkeeping.
            log.warn("[WHATSAPP][INBOUND][CAPTURE] Failed to capture contact for phone={}: {}",
                    maskPhone(phone), e.toString());
            return false;
        }
    }

    /** True when an inbound message matches the configured opt-in phrase (case-insensitive). */
    private boolean matchesOptInPhrase(String bodyText) {
        if (bodyText == null || bodyText.isBlank()) return false;
        String phrase = settingValue("whatsapp.optin.phrase", "like updates");
        return phrase != null && !phrase.isBlank()
                && bodyText.toLowerCase().contains(phrase.toLowerCase());
    }

    /** Reads a setting with a fallback, tolerating a missing row. */
    private String settingValue(String key, String fallback) {
        try {
            Setting s = settingsService.get(key);
            if (s == null || s.getValue() == null || s.getValue().isBlank()) return fallback;
            return s.getValue();
        } catch (Exception e) {
            return fallback;
        }
    }

    /**
     * Schedules an auto-reply to fire AFTER the enclosing transaction commits,
     * so the HTTP call to Meta API does not hold the DB connection open.
     */
    private void sendAutoReply(String phone, boolean justOptedIn) {
        String mainNumber = mainWhatsAppNumber();
        // A welcome does not reference the support number, so it can still be sent when
        // brand.whatsapp is unset. The standard reply cannot — it is entirely a redirect.
        if (mainNumber.isBlank() && !justOptedIn) {
            log.debug("[WHATSAPP][AUTO_REPLY] brand.whatsapp not configured, skipping");
            return;
        }
        String ownDigits = ownPhoneDigits();
        String incomingDigits = phone == null ? "" : phone.replaceAll("[^0-9]", "");
        if (!ownDigits.isBlank() && incomingDigits.endsWith(ownDigits)) {
            log.debug("[WHATSAPP][AUTO_REPLY] Skipping auto-reply to own number");
            return;
        }
        // Rate-limit: one auto-reply per phone per 5 minutes to prevent reply loops.
        // Evict stale entries first so the map stays bounded under spam traffic.
        long now = System.currentTimeMillis();
        long evictBefore = now - AUTO_REPLY_COOLDOWN_MS;
        AUTO_REPLY_LAST_SENT.entrySet().removeIf(e -> e.getValue() < evictBefore);

        Long lastSent = AUTO_REPLY_LAST_SENT.get(phone);
        if (lastSent != null && (now - lastSent) < AUTO_REPLY_COOLDOWN_MS) {
            log.debug("[WHATSAPP][AUTO_REPLY] Rate-limited for phone={}", maskPhone(phone));
            return;
        }
        AUTO_REPLY_LAST_SENT.put(phone, now);

        // Two different replies, because the first message means something different from the rest.
        //
        // A contact arriving through the expo QR has just asked to hear from us — greeting them with
        // "this number is send-only, go away" is a poor welcome and pushes them off the very number
        // whose engagement history makes them reachable by marketing. They get a welcome instead.
        // Everyone messaging afterwards gets the redirect to the staffed support number, since this
        // number is not monitored for conversations.
        String message;
        if (justOptedIn) {
            message = settingValue("whatsapp.autoreply.welcome",
                    "Hello and welcome to Blossom Buds Floral Artistry! 🌸 "
                            + "You're all set — you'll receive our latest offers, new arrivals and "
                            + "festival specials right here. Reply STOP at any time to unsubscribe.");
        } else {
            String waLink = "https://wa.me/" + mainNumber;
            message = settingValue("whatsapp.autoreply.default",
                    "Hi! This number is used only for sending order updates and offers. "
                            + "For queries or support, please reach us directly here: " + waLink);
        }

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            // Defer the HTTP call until after commit so the DB connection is released first.
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    sendAutoReplyHttp(phone, message);
                }
            });
        } else {
            // No active transaction (e.g. called from a test or scheduler) — send directly.
            sendAutoReplyHttp(phone, message);
        }
    }

    /** Deactivates the sender in both preference and contacts tables, then confirms via WhatsApp. */
    private void handleStop(String phone) {
        if (phone == null || phone.isBlank()) return;
        OffsetDateTime now = OffsetDateTime.now();

        // Meta webhook sends phone without '+' (e.g. "919876543210").
        // Preferences may be stored in various formats; contacts are stored as E.164 with '+'.
        // Try both forms so we hit whichever format is in the DB.
        String withPlus    = phone.startsWith("+") ? phone : "+" + phone;
        String withoutPlus = phone.startsWith("+") ? phone.substring(1) : phone;

        preferenceRepository.findByPhoneAndActiveTrue(withPlus)
                .or(() -> preferenceRepository.findByPhoneAndActiveTrue(withoutPlus))
                .ifPresent(pref -> {
            pref.setOptedIn(false);
            pref.setOptedOutAt(now);
            pref.setActive(false);
            pref.setModifiedBy("webhook-stop");
            pref.setModifiedAt(now);
            preferenceRepository.save(pref);
            log.info("[WHATSAPP][STOP] Deactivated preference for phone={}", maskPhone(phone));
        });

        whatsAppContactRepository.findByPhone(withPlus)
                .or(() -> whatsAppContactRepository.findByPhone(withoutPlus))
                .ifPresent(contact -> {
            contact.setOptedIn(false);
            contact.setOptedOutAt(now);
            contact.setActive(false);
            contact.setModifiedBy("webhook-stop");
            contact.setModifiedAt(now);
            whatsAppContactRepository.save(contact);
            log.info("[WHATSAPP][STOP] Deactivated expo contact for phone={}", maskPhone(phone));
        });

        String confirmMessage = "You have been unsubscribed from Blossom Buds marketing messages. "
                + "You will no longer receive promotional updates from us.";

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    whatsAppCloudClient.sendTextMessage(phone, confirmMessage);
                }
            });
        } else {
            whatsAppCloudClient.sendTextMessage(phone, confirmMessage);
        }
    }

    private void sendAutoReplyHttp(String phone, String message) {
        WhatsAppCloudClient.SendResult result = whatsAppCloudClient.sendTextMessage(phone, message);
        if (result.isSuccess()) {
            log.info("[WHATSAPP][AUTO_REPLY] Sent to phone={}", maskPhone(phone));
        } else {
            log.warn("[WHATSAPP][AUTO_REPLY] Failed for phone={}: {}", maskPhone(phone), result.getErrorMessage());
        }
    }

    /** Reads brand.whatsapp from settings and strips it to digits only for wa.me link. */
    private String mainWhatsAppNumber() {
        try {
            Setting s = settingsService.get("brand.whatsapp");
            if (s == null || s.getValue() == null || s.getValue().isBlank()) return "";
            return s.getValue().replaceAll("[^0-9]", "");
        } catch (Exception e) {
            return "";
        }
    }

    /** Returns last 10 digits of the Cloud API sending number to guard against echo loops. */
    private String ownPhoneDigits() {
        try {
            Setting s = settingsService.get("whatsapp.cloud.own_phone_number");
            if (s != null && s.getValue() != null && !s.getValue().isBlank()) {
                String digits = s.getValue().replaceAll("[^0-9]", "");
                return digits.length() >= 10 ? digits.substring(digits.length() - 10) : digits;
            }
            return "";
        } catch (Exception e) {
            return "";
        }
    }

    /** Updates campaign recipient row based on provider status. */
    private void updateRecipientStatus(String providerMessageId, String providerStatus, String errorMessage) {
        if (providerMessageId == null || providerMessageId.isBlank()) {
            return;
        }

        // A wamid belongs either to a campaign recipient or to a transactional send. Log the
        // transactional case explicitly: those have no recipient row, so before this the status
        // was recorded raw and then silently dropped, leaving order confirmations with no
        // observable outcome at all.
        if (recipientRepository.findByProviderMessageId(providerMessageId).isEmpty()) {
            messageEventRepository.findFirstByProviderMessageIdAndEventType(
                            providerMessageId, "OUTBOUND_TRANSACTIONAL")
                    .ifPresent(sent -> {
                        if ("failed".equalsIgnoreCase(providerStatus)) {
                            log.warn("[WHATSAPP][TXN][STATUS] {} FAILED wamid={} error={}",
                                    sent.getProviderStatus(), providerMessageId, errorMessage);
                        } else {
                            log.info("[WHATSAPP][TXN][STATUS] {} {} wamid={}",
                                    sent.getProviderStatus(), providerStatus, providerMessageId);
                        }
                    });
        }

        recipientRepository.findByProviderMessageId(providerMessageId).ifPresent(recipient -> {
            OffsetDateTime now = OffsetDateTime.now();

            if ("sent".equalsIgnoreCase(providerStatus)) {
                recipient.setStatus("SENT");
                recipient.setSentAt(recipient.getSentAt() == null ? now : recipient.getSentAt());
            } else if ("delivered".equalsIgnoreCase(providerStatus)) {
                recipient.setStatus("DELIVERED");
                recipient.setDeliveredAt(now);
            } else if ("read".equalsIgnoreCase(providerStatus)) {
                recipient.setStatus("READ");
                recipient.setReadAt(now);
            } else if ("failed".equalsIgnoreCase(providerStatus)) {
                recipient.setStatus("FAILED");
                recipient.setFailedAt(now);
                recipient.setErrorMessage(errorMessage);
            }

            recipient.setModifiedBy("webhook");
            recipient.setModifiedAt(now);
            recipientRepository.save(recipient);

            refreshCampaignCounts(recipient.getCampaignId());

            log.info("[WHATSAPP][WEBHOOK][STATUS] Updated recipientId={}, providerStatus={}",
                    recipient.getId(), providerStatus);
        });
    }

    /** Recalculates campaign status counters from recipient rows. */
    private void refreshCampaignCounts(Long campaignId) {
        if (campaignId == null) {
            return;
        }

        campaignRepository.findByIdAndActiveTrue(campaignId).ifPresent(campaign -> {
            long total = recipientRepository.countByCampaignIdAndActiveTrue(campaignId);
            long failed = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "FAILED");
            long delivered = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "DELIVERED");
            long read = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "READ");

            // A recipient's status advances SENT -> DELIVERED -> READ on one column, so counting
            // only status='SENT' made sentCount *fall* as delivery receipts arrived: a campaign
            // that reached 100 people would drift to 40, then 5. "Sent" means "left our side", so
            // everything downstream of SENT still counts as sent.
            long sent = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "SENT")
                    + delivered + read;

            campaign.setTotalRecipients((int) total);
            campaign.setSentCount((int) sent);
            campaign.setFailedCount((int) failed);
            campaign.setDeliveredCount((int) delivered);
            campaign.setReadCount((int) read);
            campaign.setModifiedBy("webhook");
            campaign.setModifiedAt(OffsetDateTime.now());

            campaignRepository.save(campaign);
        });
    }

    /** Reads a text field from a JSON node safely. */
    private String text(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        return value.isMissingNode() || value.isNull() ? "" : value.asText("");
    }

    /** Masks a phone number for safe logging. */
    private String maskPhone(String phone) {
        if (phone == null || phone.length() <= 4) {
            return "****";
        }
        return "****" + phone.substring(phone.length() - 4);
    }
}