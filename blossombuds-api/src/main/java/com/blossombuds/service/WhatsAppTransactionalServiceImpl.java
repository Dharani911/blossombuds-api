package com.blossombuds.service;

import com.blossombuds.domain.WhatsAppMessageEvent;
import com.blossombuds.repository.WhatsAppMessageEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Sends transactional WhatsApp messages via Meta Cloud API.
 *
 * Every attempt is recorded in whatsapp_message_events. Without that these sends were entirely
 * invisible — no row, no stored wamid — so an order confirmation that Meta rejected looked exactly
 * like one that arrived, and the delivery-status webhook (which matches on wamid against campaign
 * recipients only) had nothing to attach itself to. Recording the wamid makes the status callbacks
 * correlatable and gives the sends a history that can actually be queried.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppTransactionalServiceImpl implements WhatsAppTransactionalService {

    private final WhatsAppCloudClient whatsAppCloudClient;
    private final WhatsAppMessageEventRepository messageEventRepository;

    /** Event type marking an outbound transactional send in the shared message-event log. */
    private static final String OUTBOUND = "OUTBOUND_TRANSACTIONAL";

    /**
     * Records one transactional send attempt. Failures to record are swallowed: losing an audit
     * row must never break order processing, which is what this messaging hangs off.
     */
    private void record(String templateName, String phone, String orderCode,
                        WhatsAppCloudClient.SendResult result) {
        try {
            WhatsAppMessageEvent event = new WhatsAppMessageEvent();
            event.setEventType(OUTBOUND);
            event.setProviderStatus(templateName);
            event.setPhone(phone);
            event.setProviderMessageId(result.isSuccess() ? result.getProviderMessageId() : null);
            event.setErrorMessage(result.isSuccess() ? null : result.getErrorMessage());
            event.setRawPayload("template=" + templateName + ";orderCode=" + coalesce(orderCode, ""));
            event.setReceivedAt(OffsetDateTime.now());
            event.setCreatedAt(OffsetDateTime.now());
            messageEventRepository.save(event);
        } catch (Exception e) {
            log.warn("[WHATSAPP][TXN] Failed to record send of {} for orderCode={}: {}",
                    templateName, orderCode, e.toString());
        }
    }

    @Override
    @Async("mailExecutor")
    public void sendOrderConfirmation(String phone, String customerName, String orderCode,
                                      java.math.BigDecimal grandTotal, String currency) {
        if (isBlank(phone)) {
            log.debug("[WHATSAPP][TXN] Skipping order confirmation — no phone for orderCode={}", orderCode);
            return;
        }
        String name = coalesce(customerName, "Customer");
        // The approved template reads "*Order:* BB{{2}}" and "*Total Paid:* {{3}}" — so it takes
        // THREE variables and supplies the BB prefix itself. Sending two produced a 132000
        // parameter-count rejection on every order, and prefixing here would render "BBBB250001".
        String code = coalesce(orderCode, "");
        String total = formatAmount(grandTotal, currency);
        log.info("[WHATSAPP][TXN] Sending order_confirmation for orderCode={}", orderCode);
        WhatsAppCloudClient.SendResult result = whatsAppCloudClient.sendTemplateMessage(
                phone, "order_confirmation", "en", List.of(name, code, total)
        );
        record("order_confirmation", phone, orderCode, result);
        if (!result.isSuccess()) {
            log.warn("[WHATSAPP][TXN] order_confirmation failed for orderCode={}: {}", orderCode, result.getErrorMessage());
        } else {
            log.info("[WHATSAPP][TXN] order_confirmation accepted for orderCode={} wamid={}", orderCode, result.getProviderMessageId());
        }
    }

    @Override
    @Async("mailExecutor")
    public void sendOrderDispatched(String phone, String customerName, String orderCode,
                                    String trackingNumber, String trackingUrl) {
        if (isBlank(phone)) {
            log.debug("[WHATSAPP][TXN] Skipping order_dispatched — no phone for orderCode={}", orderCode);
            return;
        }
        String name = coalesce(customerName, "Customer");
        String code = "BB" + coalesce(orderCode, "");
        String tn   = coalesce(trackingNumber, "");
        String tu   = coalesce(trackingUrl, "");
        log.info("[WHATSAPP][TXN] Sending order_dispatched for orderCode={}", orderCode);
        WhatsAppCloudClient.SendResult result = whatsAppCloudClient.sendTemplateMessage(
                phone, "order_dispatched", "en", List.of(name, code, tn, tu)
        );
        record("order_dispatched", phone, orderCode, result);
        if (!result.isSuccess()) {
            log.warn("[WHATSAPP][TXN] order_dispatched failed for orderCode={}: {}", orderCode, result.getErrorMessage());
        } else {
            log.info("[WHATSAPP][TXN] order_dispatched accepted for orderCode={} wamid={}", orderCode, result.getProviderMessageId());
        }
    }

    @Override
    @Async("mailExecutor")
    public void sendOrderDelivered(String phone, String customerName, String orderCode,
                                   String reviewUrl) {
        if (isBlank(phone)) {
            log.debug("[WHATSAPP][TXN] Skipping order_delivered — no phone for orderCode={}", orderCode);
            return;
        }
        String name = coalesce(customerName, "Customer");
        String code = "BB" + coalesce(orderCode, "");
        String ru   = coalesce(reviewUrl, "");
        log.info("[WHATSAPP][TXN] Sending order_delivered for orderCode={}", orderCode);
        WhatsAppCloudClient.SendResult result = whatsAppCloudClient.sendTemplateMessage(
                phone, "order_delivered", "en", List.of(name, code, ru)
        );
        record("order_delivered", phone, orderCode, result);
        if (!result.isSuccess()) {
            log.warn("[WHATSAPP][TXN] order_delivered failed for orderCode={}: {}", orderCode, result.getErrorMessage());
        } else {
            log.info("[WHATSAPP][TXN] order_delivered accepted for orderCode={} wamid={}", orderCode, result.getProviderMessageId());
        }
    }

    /** Formats a money value the same way the SMS channel does, so both read identically. */
    private String formatAmount(java.math.BigDecimal amount, String currency) {
        if (amount == null) return "";
        String cur = isBlank(currency) ? "INR" : currency.trim().toUpperCase();
        return cur + " " + amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private boolean isBlank(String s) { return s == null || s.isBlank(); }
    private String coalesce(String s, String fallback) { return (s == null || s.isBlank()) ? fallback : s; }
}
