// src/main/java/com/blossombuds/web/payments/RazorpayController.java
package com.blossombuds.web.payments;

import com.blossombuds.dto.OrderDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.repository.CheckoutIntentRepository;
import com.blossombuds.service.OrderService;
import com.blossombuds.service.payments.RazorpayService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** HTTP endpoints for Razorpay: order creation, signature verification, webhooks. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/payments/razorpay")
public class RazorpayController {

    private final RazorpayService rzp;
    private final CheckoutIntentRepository checkoutIntentRepository;
    private final OrderService orderService;
    private final RazorpayService razorpayService;
    private final com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();

    /** Creates a Razorpay order for the given internal order id. */
    @PostMapping("/orders/{orderId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CUSTOMER')")
    public Map<String, Object> createOrder(@PathVariable Long orderId) {
        return rzp.createRzpOrder(orderId);
    }

    private com.blossombuds.dto.OrderDto readOrderDto(String json) {
        try { return om.readValue(json, com.blossombuds.dto.OrderDto.class); } catch (Exception e) { throw new IllegalStateException(e); }
    }
    private java.util.List<com.blossombuds.dto.OrderItemDto> readItems(String json) {
        try {
            var type = om.getTypeFactory().constructCollectionType(java.util.List.class, com.blossombuds.dto.OrderItemDto.class);
            return om.readValue(json, type);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    @PostMapping("/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyAndRecord(@RequestBody VerifyRequest req) {
        boolean ok = rzp.verifyCheckoutSignature(req.getRazorpayOrderId(), req.getRazorpayPaymentId(), req.getRazorpaySignature());
        if (!ok) throw new IllegalArgumentException("Invalid Razorpay signature");

        // 1) Find checkout intent by RZP order id
        var ciOpt = checkoutIntentRepository.findByRzpOrderId(req.getRazorpayOrderId());
        if (ciOpt.isEmpty()) throw new IllegalArgumentException("Checkout intent not found");
        var ci = ciOpt.get();
        if (!"PENDING".equals(ci.getStatus())) return; // idempotent

        // 2) Materialize DTOs
        OrderDto orderDraft = readOrderDto(ci.getOrderDraftJson());
        List<OrderItemDto> items = readItems(ci.getItemsJson());

        // 3) Create Order now (paid)
        // Reuse your OrderService but add a small helper that sets paidAt on creation
        var order = orderService.createOrderAsPaid(orderDraft, items);

        // 4) Record payment row (idempotent by rzpPaymentId)
        razorpayService.recordCapturedPayment(
                order.getId(),
                req.getRazorpayOrderId(),
                req.getRazorpayPaymentId(),
                req.getCurrency(),
                req.getAmount(),
                "customer"
        );

        // 5) Mark intent converted
        ci.setStatus("CONVERTED");
        ci.setActive(Boolean.FALSE);
        ci.setModifiedAt(OffsetDateTime.now());
        ci.setModifiedBy("system");
        checkoutIntentRepository.save(ci);
    }


    /** Handles Razorpay webhooks (e.g., payment.captured) verifying the header signature. */
    @PostMapping(value = "/webhook", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void webhook(@RequestBody String body, @RequestHeader("X-Razorpay-Signature") String signature) {
        if (!rzp.verifyWebhookSignature(body, signature)) {
            throw new IllegalArgumentException("Invalid webhook signature");
        }
        // TODO: parse event JSON and upsert payments/status accordingly if you want webhook-driven flow as well.
    }

    /** Payload from your frontend after Razorpay Checkout success. */
    @Data
    public static class VerifyRequest {
        /** Our internal order id. */
        private Long orderId;
        /** Razorpay order id. */
        private String razorpayOrderId;
        /** Razorpay payment id. */
        private String razorpayPaymentId;
        /** Razorpay signature. */
        private String razorpaySignature;
        /** Charged amount (INR), optional if you want to persist; paise can be derived if needed. */
        private BigDecimal amount;
        /** Currency code (default INR). */
        private String currency;
    }
}
