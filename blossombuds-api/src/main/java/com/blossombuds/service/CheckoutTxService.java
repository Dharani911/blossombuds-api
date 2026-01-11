package com.blossombuds.service;

import com.blossombuds.domain.CheckoutIntent;
import com.blossombuds.dto.OrderDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.repository.CheckoutIntentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** Persists CheckoutIntent in independent transactions to avoid webhook/commit race conditions. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckoutTxService {

    private final CheckoutIntentRepository ciRepo;
    private final ObjectMapper om;

    /** Creates and commits a PENDING CheckoutIntent in its own transaction. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public CheckoutIntent createIntentCommitted(OrderDto orderDraft, List<OrderItemDto> items) {
        CheckoutIntent ci = new CheckoutIntent();
        ci.setCustomerId(orderDraft.getCustomerId());
        ci.setOrderDraftJson(write(orderDraft));
        ci.setItemsJson(write(items));
        ci.setAmount(nvl(orderDraft.getGrandTotal()));
        ci.setCurrency(normCurrency(orderDraft.getCurrency()));
        ci.setStatus("PENDING");
        ci.setExpiresAt(OffsetDateTime.now().plus(2, ChronoUnit.HOURS));

        CheckoutIntent saved = ciRepo.saveAndFlush(ci);
        log.info("[CHECKOUT][INDIA][INTENT][COMMIT] checkoutIntentId={}", saved.getId());
        return saved;
    }

    /** Attaches Razorpay order id and commits immediately in its own transaction. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void attachRzpOrderIdCommitted(Long checkoutIntentId, String rzpOrderId) {
        CheckoutIntent ci = ciRepo.findById(checkoutIntentId)
                .orElseThrow(() -> new IllegalArgumentException("CheckoutIntent not found: " + checkoutIntentId));

        ci.setRzpOrderId(rzpOrderId);
        ciRepo.saveAndFlush(ci);
        log.info("[PAYMENT][RZP][ORDER_LINK][COMMIT] checkoutIntentId={} rzpOrderId={}", checkoutIntentId, rzpOrderId);
    }

    /** Serializes an object to JSON for CheckoutIntent storage. */
    private String write(Object o) {
        try { return om.writeValueAsString(o); }
        catch (Exception e) { throw new IllegalStateException("Failed to serialize checkout payload", e); }
    }

    /** Returns non-null BigDecimal. */
    private BigDecimal nvl(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    /** Normalizes currency to uppercase with INR default. */
    private String normCurrency(String cur) { return (cur == null || cur.isBlank()) ? "INR" : cur.trim().toUpperCase(); }
}
