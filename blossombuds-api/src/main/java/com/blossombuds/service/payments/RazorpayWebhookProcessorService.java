package com.blossombuds.service.payments;

import com.blossombuds.domain.RazorpayWebhookInbox;
import com.blossombuds.repository.RazorpayWebhookInboxRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RazorpayWebhookProcessorService {

    private final RazorpayWebhookInboxRepository repo;
    private final CheckoutFinalizeService finalizeService;
    private final ObjectMapper om;

    @Scheduled(fixedDelay = 15000)
    public void processInbox() {
        List<RazorpayWebhookInbox> rows = repo.findTop50ByStatusOrderByIdAsc("NEW");
        for (RazorpayWebhookInbox row : rows) {
            processOne(row.getId());
        }
    }

    @Transactional
    public void processOne(Long inboxId) {
        RazorpayWebhookInbox row = repo.findById(inboxId).orElse(null);
        if (row == null) return;
        if (!"NEW".equals(row.getStatus()) && !"FAILED".equals(row.getStatus())) return;

        row.setStatus("PROCESSING");
        row.setAttemptCount((row.getAttemptCount() == null ? 0 : row.getAttemptCount()) + 1);
        repo.save(row);

        try {
            JsonNode root = om.readTree(row.getPayloadJson());
            String event = root.path("event").asText("");

            if ("payment.captured".equalsIgnoreCase(event)) {
                JsonNode entity = root.path("payload").path("payment").path("entity");

                String rzpPaymentId = entity.path("id").asText("");
                String rzpOrderId = entity.path("order_id").asText("");
                String currency = entity.path("currency").asText("INR");
                long amountPaise = entity.path("amount").asLong(0);
                BigDecimal captured = BigDecimal.valueOf(amountPaise, 2);

                String notesCiId = entity.path("notes").path("checkoutIntentId").asText("");

                try {
                    finalizeService.finalizeCapturedPayment(
                            rzpOrderId,
                            rzpPaymentId,
                            captured,
                            currency,
                            "webhook:" + row.getEnvironment().toLowerCase()
                    );
                } catch (IllegalArgumentException ex) {
                    if (notesCiId != null && !notesCiId.isBlank()) {
                        finalizeService.finalizeCapturedPaymentByIntentId(
                                Long.parseLong(notesCiId),
                                rzpOrderId,
                                rzpPaymentId,
                                captured,
                                currency,
                                "webhook:" + row.getEnvironment().toLowerCase()
                        );
                    } else {
                        throw ex;
                    }
                }
            }
            else if ("order.paid".equalsIgnoreCase(event)) {
                log.info("[RZP][WEBHOOK][PROCESS][SKIP] order.paid stored; reconciliation will recover captured payment | inboxId={}", inboxId);
            }

            row.setStatus("DONE");
            row.setProcessedAt(OffsetDateTime.now());
            row.setLastError(null);
            repo.save(row);

        } catch (Exception e) {
            row.setStatus("FAILED");
            row.setLastError((e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            repo.save(row);
            log.error("[RZP][WEBHOOK][PROCESS][FAIL] inboxId={}", inboxId, e);
        }
    }
}