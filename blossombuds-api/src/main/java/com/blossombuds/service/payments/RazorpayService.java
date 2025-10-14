// src/main/java/com/blossombuds/service/payments/RazorpayService.java
package com.blossombuds.service.payments;

import com.blossombuds.security.RazorPayProperties;
import com.blossombuds.domain.Order;
import com.blossombuds.domain.Payment;
import com.blossombuds.domain.PaymentStatus;
import com.blossombuds.dto.PaymentDto;
import com.blossombuds.repository.OrderRepository;
import com.blossombuds.repository.PaymentRepository;
import com.blossombuds.security.RazorPayProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Map;

/** Payment façade for Razorpay: create order, verify signatures, and persist payments. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RazorpayService {

    private final RazorpayApiClient api;
    private final RazorPayProperties props;
    private final OrderRepository orderRepo;
    private final PaymentRepository paymentRepo;

    /** Creates a Razorpay order for our internal order id and returns API payload. */
    @Transactional
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CUSTOMER')")
    public Map<String, Object> createRzpOrder(Long orderId) {
        Order o = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        BigDecimal grand = o.getGrandTotal() == null ? BigDecimal.ZERO : o.getGrandTotal();
        long amountPaise = grand.movePointRight(2).longValueExact(); // INR paise

        String currency = (o.getCurrency() == null || o.getCurrency().isBlank()) ? "INR" : o.getCurrency().trim().toUpperCase();
        String receipt = "BB" + o.getPublicCode();

        Map<String, Object> res = api.createOrder(amountPaise, currency, receipt,
                Map.of("orderId", String.valueOf(o.getId()), "publicCode", o.getPublicCode()),
                true // auto-capture
        );

        // Store Razorpay order id on our order for easy lookup (optional)
        Object rid = res.get("id");
        if (rid instanceof String rzpOrderId) {
            o.setRzpOrderId(rzpOrderId);
            orderRepo.save(o);
        }
        return res;
    }

    /** Verifies checkout signature (orderId|paymentId) with API secret. */
    public boolean verifyCheckoutSignature(String rzpOrderId, String rzpPaymentId, String rzpSignature) {
        String data = rzpOrderId + "|" + rzpPaymentId;
        String expected = hmacSha256Hex(props.getKeySecret(), data);
        return expected.equals(rzpSignature);
    }

    /** Verifies webhook signature (raw body) with webhook secret. */
    public boolean verifyWebhookSignature(String rawBody, String headerSignature) {
        String expected = hmacSha256Hex(props.getWebhookSecret(), rawBody);
        return expected.equals(headerSignature);
    }

    /** Records a successful captured payment for an order (idempotent by rzpPaymentId). */
    @Transactional
    public Payment recordCapturedPayment(Long orderId, String rzpOrderId, String rzpPaymentId, String currency, BigDecimal amount, String actor) {
        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        // Idempotency: if we already stored this paymentId, short-circuit
        if (paymentRepo.findByRzpPaymentId(rzpPaymentId).isPresent()) {
            return paymentRepo.findByRzpPaymentId(rzpPaymentId).get();
        }

        Payment p = new Payment();
        p.setOrder(order);
        p.setStatus(PaymentStatus.CAPTURED);
        p.setAmount(amount);
        p.setCurrency(currency == null ? "INR" : currency.trim().toUpperCase());
        p.setRzpOrderId(rzpOrderId);
        p.setRzpPaymentId(rzpPaymentId);
        p.setActive(Boolean.TRUE);
        p.setCreatedAt(OffsetDateTime.now());
        p.setCreatedBy(actor == null ? "system" : actor);
        p.setModifiedAt(p.getCreatedAt());
        p.setModifiedBy(p.getCreatedBy());
        paymentRepo.save(p);

        // Mark order paid (same behavior as your OrderService.recordPayment)
        order.setPaidAt(OffsetDateTime.now());
        orderRepo.save(order);

        return p;
    }

    /** Computes an HMAC-SHA256 hex digest. */
    private static String hmacSha256Hex(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(raw.length * 2);
            for (byte b : raw) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("HMAC verification failed", e);
        }
    }
    // Create a Razorpay order for an arbitrary amount (used by CheckoutIntent).
    @Transactional
    public Map<String, Object> createRzpOrderForAmount(long amountPaise, String currency,
                                                       String receipt, Map<String,String> notes, boolean capture) {
        return api.createOrder(amountPaise, currency, receipt, notes, capture);
    }

}
