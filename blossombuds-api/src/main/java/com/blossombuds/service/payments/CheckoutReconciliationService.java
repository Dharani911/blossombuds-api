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

@Slf4j
@Service
@RequiredArgsConstructor
public class CheckoutReconciliationService {

    private final CheckoutIntentRepository checkoutIntentRepository;
    private final RazorpayApiClient apiClient;
    private final CheckoutFinalizeService finalizeService;

    @Scheduled(fixedDelay = 60000)
    public void reconcilePendingIntents() {
        List<CheckoutIntent> intents = checkoutIntentRepository.findTop100ByStatusInAndActiveTrueOrderByIdAsc(
                List.of("PENDING", "CONVERTING")
        );

        for (CheckoutIntent ci : intents) {
            tryRecover(ci);
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