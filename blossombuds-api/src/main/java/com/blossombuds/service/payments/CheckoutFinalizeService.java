package com.blossombuds.service.payments;

import com.blossombuds.dto.OrderDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.repository.CheckoutIntentRepository;
import com.blossombuds.service.OrderService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/** Finalizes a PENDING CheckoutIntent into a paid Order + captured Payment (idempotent). */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckoutFinalizeService {

    private final CheckoutIntentRepository checkoutIntentRepository;
    private final OrderService orderService;
    private final RazorpayService rzp;
    private final ObjectMapper om;

    /** Converts a PENDING intent identified by rzpOrderId into a paid order and records the captured payment. */
    @Transactional
    public void finalizeCapturedPayment(String rzpOrderId,
                                        String rzpPaymentId,
                                        BigDecimal capturedAmount,
                                        String currency,
                                        String actor) {

        if (rzpOrderId == null || rzpOrderId.isBlank()) {
            throw new IllegalArgumentException("rzpOrderId is required");
        }
        if (rzpPaymentId == null || rzpPaymentId.isBlank()) {
            throw new IllegalArgumentException("rzpPaymentId is required");
        }

        // 🔒 Lock the intent row to avoid webhook+verify double conversion
        var ci = checkoutIntentRepository.findForUpdateByRzpOrderId(rzpOrderId)
                .orElseThrow(() -> new IllegalArgumentException("Checkout intent not found for rzpOrderId=" + rzpOrderId));

        // Normalize status
        String st = (ci.getStatus() == null) ? "" : ci.getStatus().trim().toUpperCase();

        // ✅ Idempotency + concurrency guard
        if ("CONVERTED".equals(st)) {
            log.info("[PAYMENT][FINALIZE][SKIP] already converted | rzpOrderId={}", rzpOrderId);
            return;
        }
        if ("CONVERTING".equals(st)) {
            log.info("[PAYMENT][FINALIZE][SKIP] converting in progress | rzpOrderId={}", rzpOrderId);
            return;
        }
        if (!"PENDING".equals(st)) {
            log.info("[PAYMENT][FINALIZE][SKIP] status={} | rzpOrderId={}", st, rzpOrderId);
            return;
        }

        // ✅ Mark converting FIRST (prevents duplicate order creation on crash/retry)
        ci.setStatus("CONVERTING");
        checkoutIntentRepository.save(ci);

        // Materialize LOBs while TX is open
        try {
            final String orderDraftJson = ci.getOrderDraftJson();

            final String itemsJson = ci.getItemsJson();

            OrderDto orderDraft = readOrderDto(orderDraftJson);
            List<OrderItemDto> items = readItems(itemsJson);

            // Create the paid order from draft
            var order = orderService.createOrderAsPaid(orderDraft, items);

            // Record payment (idempotent by rzpPaymentId). Prefer captured amount if provided, else order grand total.
            BigDecimal amt = (capturedAmount != null) ? capturedAmount : order.getGrandTotal();
            String cur = (currency == null || currency.isBlank()) ? "INR" : currency.trim().toUpperCase();

            rzp.recordCapturedPayment(
                    order.getId(),
                    rzpOrderId,
                    rzpPaymentId,
                    cur,
                    amt,
                    (actor == null || actor.isBlank()) ? "system" : actor
            );

            // Mark intent converted
            ci.setStatus("CONVERTED");
            ci.setActive(Boolean.FALSE);
            checkoutIntentRepository.save(ci);

            log.info("[PAYMENT][FINALIZE][OK] rzpOrderId={} rzpPaymentId={} orderId={}", rzpOrderId, rzpPaymentId, order.getId());
        }catch (RuntimeException e) {
            // revert so it can be retried
            ci.setStatus("PENDING");
            checkoutIntentRepository.save(ci);
            log.error("[PAYMENT][FINALIZE][ERR] rzpOrderId={} reverting to PENDING", rzpOrderId, e);
            throw e;
        }
    }
    @Transactional
    public void finalizeCapturedPaymentByIntentId(Long checkoutIntentId,
                                                  String rzpOrderId,
                                                  String rzpPaymentId,
                                                  BigDecimal capturedAmount,
                                                  String currency,
                                                  String actor) {

        if (checkoutIntentId == null) throw new IllegalArgumentException("checkoutIntentId is required");
        if (rzpPaymentId == null || rzpPaymentId.isBlank()) throw new IllegalArgumentException("rzpPaymentId is required");

        var ci = checkoutIntentRepository.findForUpdateById(checkoutIntentId)
                .orElseThrow(() -> new IllegalArgumentException("Checkout intent not found: " + checkoutIntentId));

        // If rzpOrderId not stored yet (crash gap), store it now
        if (ci.getRzpOrderId() == null || ci.getRzpOrderId().isBlank()) {
            ci.setRzpOrderId(rzpOrderId);
            checkoutIntentRepository.save(ci);
        }

        // Now reuse existing finalize path (by rzpOrderId)
        finalizeCapturedPayment(ci.getRzpOrderId(), rzpPaymentId, capturedAmount, currency, actor);
    }


    /** Parses OrderDto stored as JSON in CheckoutIntent. */
    private OrderDto readOrderDto(String json) {
        try {
            return om.readValue(json, OrderDto.class);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse OrderDto from intent", e);
        }
    }

    /** Parses OrderItemDto list stored as JSON in CheckoutIntent. */
    private List<OrderItemDto> readItems(String json) {
        try {
            var type = om.getTypeFactory().constructCollectionType(List.class, OrderItemDto.class);
            return om.readValue(json, type);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse OrderItemDto[] from intent", e);
        }
    }
}
