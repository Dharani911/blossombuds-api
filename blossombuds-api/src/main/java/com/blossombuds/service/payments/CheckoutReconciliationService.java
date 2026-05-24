package com.blossombuds.service.payments;

import com.blossombuds.domain.CheckoutIntent;
import com.blossombuds.repository.CheckoutIntentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import com.blossombuds.service.SettingsService;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckoutReconciliationService {

    private final CheckoutIntentRepository checkoutIntentRepository;
    private final RazorpayApiClient apiClient;
    private final CheckoutFinalizeService finalizeService;
    private final SettingsService settingsService;

    @Scheduled(fixedDelay = 300000)
    public void reconcilePendingIntents() {
        LocalDateTime now = LocalDateTime.now();

        LocalDateTime cutoffAt = readCutoffAt(now);
        long maxAgeHours = readMaxAgeHours();

        LocalDateTime maxAgeStart = now.minusHours(maxAgeHours);
        LocalDateTime startTime = cutoffAt.isAfter(maxAgeStart) ? cutoffAt : maxAgeStart;
        LocalDateTime safeUpperTime = now.minusMinutes(5);

        if (!startTime.isBefore(safeUpperTime)) {
            log.info("[CHECKOUT][RECONCILE][SKIP] No safe window | startTime={} safeUpperTime={}",
                    startTime, safeUpperTime);
            return;
        }

        List<CheckoutIntent> intents = checkoutIntentRepository.findPendingForReconciliation(
                "PENDING",
                startTime,
                safeUpperTime,
                org.springframework.data.domain.PageRequest.of(0, 20)
        );

        log.info("[CHECKOUT][RECONCILE] cutoffAt={} maxAgeHours={} startTime={} safeUpperTime={} picked={}",
                cutoffAt, maxAgeHours, startTime, safeUpperTime, intents.size());

        for (CheckoutIntent ci : intents) {
            tryRecover(ci);
        }
    }
    private LocalDateTime readCutoffAt(LocalDateTime now) {
        String value = settingsService.safeGet("razorpay.reconciliation.cutoff_at");

        if (value == null || value.isBlank()) {
            LocalDateTime fallback = now.minusHours(24);
            log.warn("[CHECKOUT][RECONCILE][CONFIG] cutoff_at missing. Using fallback={}", fallback);
            return fallback;
        }

        try {
            return OffsetDateTime.parse(value.trim()).toLocalDateTime();
        } catch (DateTimeParseException e) {
            LocalDateTime fallback = now.minusHours(24);
            log.warn("[CHECKOUT][RECONCILE][CONFIG] Invalid cutoff_at='{}'. Using fallback={}", value, fallback);
            return fallback;
        }
    }

    private long readMaxAgeHours() {
        String value = settingsService.safeGet("razorpay.reconciliation.max_age_hours");

        if (value == null || value.isBlank()) {
            return 24L;
        }

        try {
            long parsed = Long.parseLong(value.trim());
            if (parsed <= 0 || parsed > 72) {
                log.warn("[CHECKOUT][RECONCILE][CONFIG] Invalid max_age_hours='{}'. Using 24", value);
                return 24L;
            }
            return parsed;
        } catch (NumberFormatException e) {
            log.warn("[CHECKOUT][RECONCILE][CONFIG] Invalid max_age_hours='{}'. Using 24", value);
            return 24L;
        }
    }

    @SuppressWarnings("unchecked")
    private void tryRecover(CheckoutIntent ci) {
        if (ci.getRzpOrderId() == null || ci.getRzpOrderId().isBlank()) {
            return;
        }

        try {
            Map<String, Object> res = apiClient.fetchOrderPayments(ci.getRzpOrderId());
            Object itemsObj = res.get("items");
            if (!(itemsObj instanceof List<?> items) || items.isEmpty()) {
                return;
            }

            for (Object itemObj : items) {
                if (!(itemObj instanceof Map<?, ?> payment)) continue;

                String status = String.valueOf(payment.get("status"));
                if (!"captured".equalsIgnoreCase(status)) continue;

                String paymentId = String.valueOf(payment.get("id"));

                Object currencyObj = payment.get("currency");
                String currency = currencyObj == null ? "INR" : String.valueOf(currencyObj);

                Number amountNum = (Number) payment.get("amount");
                BigDecimal amount = amountNum == null
                        ? null
                        : BigDecimal.valueOf(amountNum.longValue(), 2);

                finalizeService.finalizeCapturedPayment(
                        ci.getRzpOrderId(),
                        paymentId,
                        amount,
                        currency,
                        "reconcile"
                );
                return;
            }
        } catch (Exception e) {
            log.warn("[CHECKOUT][RECONCILE][FAIL] intentId={} rzpOrderId={}",
                    ci.getId(), ci.getRzpOrderId(), e);
        }
    }
}