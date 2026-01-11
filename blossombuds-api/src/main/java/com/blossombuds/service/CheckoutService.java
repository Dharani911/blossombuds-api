package com.blossombuds.service;

import com.blossombuds.domain.CheckoutIntent;
import com.blossombuds.domain.Country;
import com.blossombuds.domain.Customer;
import com.blossombuds.dto.OrderDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.repository.CheckoutIntentRepository;
import com.blossombuds.repository.CountryRepository;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.service.payments.RazorpayService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Orchestrates checkout: India → create intent+RZP order; International → WhatsApp link. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckoutService {

    private final CountryRepository countryRepo;
    private final CustomerRepository customerRepo;
    private final CheckoutIntentRepository ciRepo;
    private final WhatsAppPayloadBuilder waBuilder;
    private final RazorpayService rzpService;
    private final CheckoutTxService checkoutTxService;
    private final ObjectMapper om = new ObjectMapper();

    /** Starts checkout. India → returns RZP order payload; Intl → WhatsApp URL. */
    /*@Transactional
    public Decision startCheckout(OrderDto orderDraft, List<OrderItemDto> items) {
        final Instant t0 = Instant.now();
        final Long shipCountryId = orderDraft != null ? orderDraft.getShipCountryId() : null;
        final Long customerId = orderDraft != null ? orderDraft.getCustomerId() : null;

        log.info("[CHECKOUT][START] shipCountryId={} customerId={} itemsCount={} currency='{}' grandTotal={}",
                shipCountryId,
                customerId,
                (items != null ? items.size() : 0),
                (orderDraft != null ? orderDraft.getCurrency() : null),
                (orderDraft != null ? orderDraft.getGrandTotal() : null));

        Country country = countryRepo.findById(orderDraft.getShipCountryId())
                .orElseThrow(() -> {
                    log.warn("[CHECKOUT][FAIL] Country not found: {}", shipCountryId);
                    return new IllegalArgumentException("Country not found: " + shipCountryId);
                });
        if (!isIndia(country)) {
            log.info("[CHECKOUT][INTL] Building WhatsApp URL for non-India destination");
            Customer c = (customerId == null) ? null : customerRepo.findById(customerId).orElse(null);
            String url = waBuilder.buildForOrderDraft(orderDraft, items, c);
            log.info("[CHECKOUT][INTL][OK] whatsappUrlBuilt elapsedMs={}", java.time.Duration.between(t0, Instant.now()).toMillis());
            return Decision.whatsapp(url);
        }

        // India-only: create checkout intent
        BigDecimal grand = nvl(orderDraft.getGrandTotal());
        String currency = normCurrency(orderDraft.getCurrency());
        log.info("[CHECKOUT][INDIA] Creating checkout intent grand={} currency='{}'", grand, currency);

        CheckoutIntent ci = new CheckoutIntent();
        ci.setCustomerId(orderDraft.getCustomerId());
        ci.setOrderDraftJson(write(orderDraft));
        ci.setItemsJson(write(items));
        ci.setAmount(grand);
        ci.setCurrency(currency);
        ci.setStatus("PENDING");
        ci.setExpiresAt(OffsetDateTime.now().plus(2, ChronoUnit.HOURS));
        //ci.setCreatedAt(OffsetDateTime.now());
        //ci.setCreatedBy("system");
        ciRepo.saveAndFlush(ci);
        log.info("[CHECKOUT][INDIA][INTENT][OK] checkoutIntentId={}", ci.getId());


        // Create Razorpay order tied to this intent (use receipt for friendly code)
        long paise = grand.movePointRight(2).longValueExact();
        Map<String, String> notes = new HashMap<>();
        notes.put("checkoutIntentId", String.valueOf(ci.getId()));
        notes.put("customerId", String.valueOf(orderDraft.getCustomerId()));

        log.info("[PAYMENT][RZP][ORDER_CREATE] paise={} currency='{}' receipt='CI{}'", paise, currency, ci.getId());
        Map<String, Object> rzp = rzpService.createRzpOrderForAmount(paise, currency, "CI" + ci.getId(), notes, true);
        String rzpOrderId = (String) rzp.get("id");
        ci.setRzpOrderId(rzpOrderId);
        ciRepo.saveAndFlush(ci);
        log.info("[PAYMENT][RZP][ORDER_CREATE][OK] rzpOrderId={} checkoutIntentId={} elapsedMs={}",
                rzpOrderId, ci.getId(), java.time.Duration.between(t0, Instant.now()).toMillis());

        return Decision.rzpOrder(rzp, currency);
    }
*/
    /** Starts checkout. India → returns RZP order payload; Intl → WhatsApp URL. */
    public Decision startCheckout(OrderDto orderDraft, List<OrderItemDto> items) {
        final Instant t0 = Instant.now();
        final Long shipCountryId = orderDraft != null ? orderDraft.getShipCountryId() : null;
        final Long customerId = orderDraft != null ? orderDraft.getCustomerId() : null;

        log.info("[CHECKOUT][START] shipCountryId={} customerId={} itemsCount={} currency='{}' grandTotal={}",
                shipCountryId,
                customerId,
                (items != null ? items.size() : 0),
                (orderDraft != null ? orderDraft.getCurrency() : null),
                (orderDraft != null ? orderDraft.getGrandTotal() : null));

        Country country = countryRepo.findById(orderDraft.getShipCountryId())
                .orElseThrow(() -> new IllegalArgumentException("Country not found: " + shipCountryId));

        // International
        if (!isIndia(country)) {
            log.info("[CHECKOUT][INTL] Building WhatsApp URL for non-India destination");
            Customer c = (customerId == null) ? null : customerRepo.findById(customerId).orElse(null);
            String url = waBuilder.buildForOrderDraft(orderDraft, items, c);
            log.info("[CHECKOUT][INTL][OK] elapsedMs={}", java.time.Duration.between(t0, Instant.now()).toMillis());
            return Decision.whatsapp(url);
        }

        // India: (1) commit intent first
        BigDecimal grand = nvl(orderDraft.getGrandTotal());
        String currency = normCurrency(orderDraft.getCurrency());
        log.info("[CHECKOUT][INDIA] Creating intent (commit-first) grand={} currency='{}'", grand, currency);

        var ci = checkoutTxService.createIntentCommitted(orderDraft, items);

        // (2) call Razorpay outside DB transaction
        long paise = grand.movePointRight(2).longValueExact();
        Map<String, String> notes = new HashMap<>();
        notes.put("checkoutIntentId", String.valueOf(ci.getId()));
        notes.put("customerId", String.valueOf(orderDraft.getCustomerId()));

        log.info("[PAYMENT][RZP][ORDER_CREATE] paise={} currency='{}' receipt='CI{}'", paise, currency, ci.getId());
        Map<String, Object> rzp = rzpService.createRzpOrderForAmount(paise, currency, "CI" + ci.getId(), notes, true);
        String rzpOrderId = (String) rzp.get("id");

        // (3) commit rzpOrderId link immediately
        checkoutTxService.attachRzpOrderIdCommitted(ci.getId(), rzpOrderId);

        log.info("[PAYMENT][RZP][ORDER_CREATE][OK] rzpOrderId={} checkoutIntentId={} elapsedMs={}",
                rzpOrderId, ci.getId(), java.time.Duration.between(t0, Instant.now()).toMillis());

        return Decision.rzpOrder(rzp, currency);
    }

    // ---------- helpers ----------
    private String write(Object o) {
        try { return om.writeValueAsString(o); }
        catch (Exception e) {
            log.error("[CHECKOUT][SERIALIZE][FAIL] type={} err={}",
                    (o == null ? "null" : o.getClass().getSimpleName()),
                    e.toString());
            throw new IllegalStateException(e);
        }
    }
    private boolean isIndia(Country c) {
        if (c.getName() != null && c.getName().equalsIgnoreCase("India")) return true;
        try { var m = c.getClass().getMethod("getCode"); Object v = m.invoke(c); if (v instanceof String s && s.equalsIgnoreCase("IN")) return true; } catch (Exception ignore) {}
        try { var m = c.getClass().getMethod("getIsoCode"); Object v = m.invoke(c); if (v instanceof String s && s.equalsIgnoreCase("IN")) return true; } catch (Exception ignore) {}
        return false;
    }
    private BigDecimal nvl(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }
    private String normCurrency(String cur) { return (cur == null || cur.isBlank()) ? "INR" : cur.trim().toUpperCase(); }

    // API response wrapper
    @Data @AllArgsConstructor
    public static class Decision {
        public enum Type { RZP_ORDER, WHATSAPP }
        private Type type;
        private Map<String, Object> razorpayOrder; // present if RZP_ORDER
        private String currency;
        private String whatsappUrl; // present if WHATSAPP

        public static Decision rzpOrder(Map<String,Object> rzp, String currency) { return new Decision(Type.RZP_ORDER, rzp, currency, null); }
        public static Decision whatsapp(String url) { return new Decision(Type.WHATSAPP, null, null, url); }
    }
}
