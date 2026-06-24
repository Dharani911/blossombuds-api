package com.blossombuds.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

/** Sends transactional WhatsApp messages via Meta Cloud API, fire-and-forget. */
@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppTransactionalServiceImpl implements WhatsAppTransactionalService {

    private final WhatsAppCloudClient whatsAppCloudClient;

    @Override
    @Async("mailExecutor")
    public void sendOrderConfirmation(String phone, String customerName, String orderCode) {
        if (isBlank(phone)) {
            log.debug("[WHATSAPP][TXN] Skipping order confirmation — no phone for orderCode={}", orderCode);
            return;
        }
        String name = coalesce(customerName, "Customer");
        String code = "BB" + coalesce(orderCode, "");
        log.info("[WHATSAPP][TXN] Sending order_confirmation for orderCode={}", orderCode);
        WhatsAppCloudClient.SendResult result = whatsAppCloudClient.sendTemplateMessage(
                phone, "order_confirmation", "en", List.of(name, code)
        );
        if (!result.isSuccess()) {
            log.warn("[WHATSAPP][TXN] order_confirmation failed for orderCode={}: {}", orderCode, result.getErrorMessage());
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
        if (!result.isSuccess()) {
            log.warn("[WHATSAPP][TXN] order_dispatched failed for orderCode={}: {}", orderCode, result.getErrorMessage());
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
        if (!result.isSuccess()) {
            log.warn("[WHATSAPP][TXN] order_delivered failed for orderCode={}: {}", orderCode, result.getErrorMessage());
        }
    }

    private boolean isBlank(String s) { return s == null || s.isBlank(); }
    private String coalesce(String s, String fallback) { return (s == null || s.isBlank()) ? fallback : s; }
}
