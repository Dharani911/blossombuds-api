// src/main/java/com/blossombuds/web/payments/RazorpayController.java
package com.blossombuds.web.payments;

import com.blossombuds.dto.OrderDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.repository.CheckoutIntentRepository;
import com.blossombuds.security.RazorPayProperties;
import com.blossombuds.service.OrderService;
import com.blossombuds.service.payments.CheckoutFinalizeService;
import com.blossombuds.service.payments.RazorpayService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

/**
 * HTTP endpoints for Razorpay: order creation, checkout verification, and webhooks.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/payments/razorpay")
public class RazorpayController {

    private final RazorpayService rzp;
    private final CheckoutIntentRepository checkoutIntentRepository;
    private final OrderService orderService;
    private final RazorPayProperties props;
    private final ObjectMapper om;
    private final CheckoutFinalizeService finalizeService;


    @GetMapping("/config")
    @PreAuthorize("permitAll()")
    public Map<String, String> config() {
        return Map.of("keyId", props.getKeyId());
    }

    /** Creates a Razorpay order for our internal order id (server→Razorpay). */
    @PostMapping("/orders/{orderId}")
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public Map<String, Object> createOrder(@PathVariable Long orderId) {
        return rzp.createRzpOrder(orderId);
    }

    /**
     * Frontend posts here AFTER Razorpay Checkout success (has orderId, paymentId, signature).
     * We verify the signature, create the Order (from the stored CheckoutIntent), and record the payment.
     */
   /* @PostMapping("/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @org.springframework.transaction.annotation.Transactional // <— IMPORTANT
    public void verifyAndRecord(@RequestBody VerifyRequest req) {
        boolean ok = rzp.verifyCheckoutSignature(
                req.getRazorpayOrderId(),
                req.getRazorpayPaymentId(),
                req.getRazorpaySignature()
        );
        if (!ok) throw new IllegalArgumentException("Invalid Razorpay signature");

        // 1) Load the intent inside the TX
        var ci = checkoutIntentRepository.findByRzpOrderId(req.getRazorpayOrderId())
                .orElseThrow(() -> new IllegalArgumentException("Checkout intent not found"));
        if (!"PENDING".equals(ci.getStatus())) return; // idempotent

        // 2) MATERIALIZE LOBs while TX is open
        final String orderDraftJson = ci.getOrderDraftJson();
        final String itemsJson      = ci.getItemsJson();

        // 3) Deserialize
        OrderDto orderDraft = readOrderDto(orderDraftJson);
        List<OrderItemDto> items = readItems(itemsJson);

        // 4) Create paid order
        var order = orderService.createOrderAsPaid(orderDraft, items);

        // 5) Record payment (idempotent by rzpPaymentId)
        rzp.recordCapturedPayment(
                order.getId(),
                req.getRazorpayOrderId(),
                req.getRazorpayPaymentId(),
                (req.getCurrency() == null || req.getCurrency().isBlank()) ? "INR" : req.getCurrency(),
                req.getAmount() == null ? order.getGrandTotal() : req.getAmount(),
                "customer"
        );

        // 6) Mark intent converted
        ci.setStatus("CONVERTED");
        ci.setActive(Boolean.FALSE);
        //ci.setModifiedAt(OffsetDateTime.now());
        //ci.setModifiedBy("system");
        checkoutIntentRepository.save(ci);
    }*/
    /** Verifies Razorpay signature and finalizes the pending CheckoutIntent into an order. */
    @PostMapping("/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @org.springframework.transaction.annotation.Transactional
    public void verifyAndRecord(@RequestBody VerifyRequest req) {

        boolean ok = rzp.verifyCheckoutSignature(
                req.getRazorpayOrderId(),
                req.getRazorpayPaymentId(),
                req.getRazorpaySignature()
        );
        if (!ok) throw new IllegalArgumentException("Invalid Razorpay signature");

        // ✅ Finalize from server-side stored intent (do NOT trust client amount)
        finalizeService.finalizeCapturedPayment(
                req.getRazorpayOrderId(),
                req.getRazorpayPaymentId(),
                null, // ignore client-provided amount
                req.getCurrency(),
                "customer"
        );
    }


    /* ----------------------------- WEBHOOKS ----------------------------- */

    /** LIVE webhook (Razorpay Live dashboard) — uses live secret. */
    @PostMapping(value = "/webhook", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void webhookLive(@RequestBody String body,
                            @RequestHeader("X-Razorpay-Signature") String signature) {
        String secret = props.getWebhookSecret();
        if (secret == null || secret.isBlank())
            throw new IllegalStateException("Live webhook secret not configured");
        if (!rzp.verifyWebhookSignature(body, signature, secret))
            throw new IllegalArgumentException("Invalid LIVE webhook signature");
        handleWebhook(body, "LIVE");
    }

    /** TEST webhook (Razorpay Test dashboard) — distinct secret & path. */
    @PostMapping(value = "/webhook/test", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void webhookTest(@RequestBody String body,
                            @RequestHeader("X-Razorpay-Signature") String signature) {
        String secret = props.getWebhookSecretTest();
        if (secret == null || secret.isBlank())
            throw new IllegalStateException("Test webhook secret not configured");
        if (!rzp.verifyWebhookSignature(body, signature, secret))
            throw new IllegalArgumentException("Invalid TEST webhook signature");
        handleWebhook(body, "TEST");
    }

    /** STAGE webhook (Razorpay Test dashboard; separate secret) — distinct path. */
    @PostMapping(value = "/webhook/stage", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void webhookStage(@RequestBody String body,
                             @RequestHeader("X-Razorpay-Signature") String signature) {
        String secret = props.getWebhookSecretStage();
        if (secret == null || secret.isBlank())
            throw new IllegalStateException("Stage webhook secret not configured");
        if (!rzp.verifyWebhookSignature(body, signature, secret))
            throw new IllegalArgumentException("Invalid STAGE webhook signature");
        handleWebhook(body, "STAGE");
    }

    /* ----------------------------- Helpers ----------------------------- */

    private OrderDto readOrderDto(String json) {
        try { return om.readValue(json, OrderDto.class); }
        catch (Exception e) { throw new IllegalStateException("Failed to parse OrderDto from intent", e); }
    }

    private List<OrderItemDto> readItems(String json) {
        try {
            var type = om.getTypeFactory().constructCollectionType(List.class, OrderItemDto.class);
            return om.readValue(json, type);
        } catch (Exception e) { throw new IllegalStateException("Failed to parse OrderItemDto[] from intent", e); }
    }

    /**
     * Minimal webhook processor. Extend this to upsert payments/order status if you prefer webhook-driven flow.
     * For example, on "payment.captured", you can read payment id, amount, currency, notes.receipt/orderId, etc.
     */
    private void handleWebhook(String body, String env) {
        try {
            JsonNode root = om.readTree(body);
            String event = root.path("event").asText("");

            // Example: payment.captured
            /*if ("payment.captured".equalsIgnoreCase(event)) {
                JsonNode entity = root.path("payload").path("payment").path("entity");
                String rzpPaymentId = entity.path("id").asText("");
                long amountPaise = entity.path("amount").asLong(0);
                String currency = entity.path("currency").asText("INR");
                String rzpOrderId = entity.path("order_id").asText("");

                // Try to infer our internal orderId from notes or receipt if you stored it
                Long ourOrderId = null;
                String notesOrderId = entity.path("notes").path("orderId").asText("");
                if (!notesOrderId.isBlank()) {
                    try { ourOrderId = Long.parseLong(notesOrderId); } catch (NumberFormatException ignored) {}
                }

                // If you saved rzpOrderId on Order (as in your service), you can look it up here instead.
                // Example:
                // Optional<Order> maybeOrder = orderRepo.findByRzpOrderId(rzpOrderId);
                // if (maybeOrder.isPresent()) { ourOrderId = maybeOrder.get().getId(); }

                if (ourOrderId != null) {
                    rzp.recordCapturedPayment(
                            ourOrderId,
                            rzpOrderId,
                            rzpPaymentId,
                            currency,
                            BigDecimal.valueOf(amountPaise, 2),
                            "webhook:" + env.toLowerCase()
                    );
                }

                // You can also transition order status, send emails, etc.
                return;
            }*/
            if ("payment.captured".equalsIgnoreCase(event)) {
                JsonNode entity = root.path("payload").path("payment").path("entity");

                String rzpPaymentId = entity.path("id").asText("");
                long amountPaise = entity.path("amount").asLong(0);
                String currency = entity.path("currency").asText("INR");
                String rzpOrderId = entity.path("order_id").asText("");

                // Convert paise to BigDecimal INR
                BigDecimal captured = BigDecimal.valueOf(amountPaise, 2);
                String notesCiId = entity.path("notes").path("checkoutIntentId").asText("");
                try {
                    // Primary path (fast): finalize by rzpOrderId
                    finalizeService.finalizeCapturedPayment(
                            rzpOrderId,
                            rzpPaymentId,
                            captured,
                            currency,
                            "webhook:" + env.toLowerCase()
                    );
                } catch (IllegalArgumentException ex) {
                    // Fallback path: intent row exists but rzpOrderId link wasn't committed yet
                    if (notesCiId != null && !notesCiId.isBlank()) {
                        try {
                            Long checkoutIntentId = Long.parseLong(notesCiId);

                            finalizeService.finalizeCapturedPaymentByIntentId(
                                    checkoutIntentId,
                                    rzpOrderId,
                                    rzpPaymentId,
                                    captured,
                                    currency,
                                    "webhook:" + env.toLowerCase()
                            );
                            return;
                        } catch (NumberFormatException ignore) {
                            // fall through and rethrow original
                        }
                    }
                    throw ex;
                }

                return;
            }


            // Handle other events if needed (order.paid, payment.failed, refund.processed, ...)
            // No-op by default.

        } catch (Exception e) {
            // For webhooks, prefer throwing to surface 4xx/5xx to the sender
            throw new IllegalStateException("Failed to process Razorpay webhook (" + env + "): " + e.getMessage(), e);
        }
    }


    /* ----------------------------- DTO ----------------------------- */
    @Data
    public static class VerifyRequest {
        /** Our internal order id (not strictly required if you lookup by rzpOrderId). */
        private Long orderId;
        /** Razorpay order id (from checkout success). */
        private String razorpayOrderId;
        /** Razorpay payment id (from checkout success). */
        private String razorpayPaymentId;
        /** Razorpay signature (from checkout success). */
        private String razorpaySignature;
        /** Charged amount (INR). Optional; defaults to order.getGrandTotal(). */
        private BigDecimal amount;
        /** Currency (default INR). */
        private String currency;
    }
}
