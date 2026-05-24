package com.blossombuds.service.payments;

import com.blossombuds.domain.RazorpayWebhookInbox;
import com.blossombuds.repository.RazorpayWebhookInboxRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class RazorpayWebhookInboxService {

    private final RazorpayWebhookInboxRepository repo;
    private final ObjectMapper om;

    @Transactional
    public void ingest(String rawBody, String env) {
        try {
            JsonNode root = om.readTree(rawBody);
            String event = root.path("event").asText("");
            JsonNode payment = root.path("payload").path("payment").path("entity");

            RazorpayWebhookInbox row = new RazorpayWebhookInbox();
            row.setEnvironment(env);
            row.setEventType(event);
            row.setRzpOrderId(payment.path("order_id").asText(""));
            row.setRzpPaymentId(payment.path("id").asText(""));
            row.setPayloadJson(rawBody);
            row.setStatus("NEW");

            repo.save(row);

            log.info("[RZP][WEBHOOK][INGEST] env={} event={} paymentId={} orderId={}",
                    env, event, row.getRzpPaymentId(), row.getRzpOrderId());
        } catch (Exception e) {
            log.error("[RZP][WEBHOOK][INGEST][FAIL] env={}", env, e);
            throw new IllegalStateException("Failed to persist webhook payload", e);
        }
    }
}