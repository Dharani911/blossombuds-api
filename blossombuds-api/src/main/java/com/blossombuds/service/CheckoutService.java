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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Orchestrates checkout: India → create intent+RZP order; International → WhatsApp link. */
@Service
@RequiredArgsConstructor
public class CheckoutService {

    private final CountryRepository countryRepo;
    private final CustomerRepository customerRepo;
    private final CheckoutIntentRepository ciRepo;
    private final WhatsAppPayloadBuilder waBuilder;
    private final RazorpayService rzpService;
    private final ObjectMapper om = new ObjectMapper();

    /** Starts checkout. India → returns RZP order payload; Intl → WhatsApp URL. */
    @Transactional
    public Decision startCheckout(OrderDto orderDraft, List<OrderItemDto> items) {
        Country country = countryRepo.findById(orderDraft.getShipCountryId())
                .orElseThrow(() -> new IllegalArgumentException("Country not found: " + orderDraft.getShipCountryId()));

        if (!isIndia(country)) {
            Customer c = (orderDraft.getCustomerId() == null) ? null :
                    customerRepo.findById(orderDraft.getCustomerId()).orElse(null);
            String url = waBuilder.buildForOrderDraft(orderDraft, items, c);
            return Decision.whatsapp(url);
        }

        // India-only: create checkout intent
        BigDecimal grand = nvl(orderDraft.getGrandTotal());
        String currency = normCurrency(orderDraft.getCurrency());

        CheckoutIntent ci = new CheckoutIntent();
        ci.setCustomerId(orderDraft.getCustomerId());
        ci.setOrderDraftJson(write(orderDraft));
        ci.setItemsJson(write(items));
        ci.setAmount(grand);
        ci.setCurrency(currency);
        ci.setStatus("PENDING");
        ci.setExpiresAt(OffsetDateTime.now().plus(2, ChronoUnit.HOURS));
        ci.setCreatedAt(OffsetDateTime.now());
        ci.setCreatedBy("system");
        ciRepo.save(ci);

        // Create Razorpay order tied to this intent (use receipt for friendly code)
        long paise = grand.movePointRight(2).longValueExact();
        Map<String, String> notes = new HashMap<>();
        notes.put("checkoutIntentId", String.valueOf(ci.getId()));
        notes.put("customerId", String.valueOf(orderDraft.getCustomerId()));

        Map<String, Object> rzp = rzpService.createRzpOrderForAmount(paise, currency, "CI" + ci.getId(), notes, true);
        String rzpOrderId = (String) rzp.get("id");
        ci.setRzpOrderId(rzpOrderId);
        ci.setModifiedAt(OffsetDateTime.now());
        ci.setModifiedBy("system");

        return Decision.rzpOrder(rzp, currency);
    }

    // ---------- helpers ----------
    private String write(Object o) {
        try { return om.writeValueAsString(o); } catch (Exception e) { throw new IllegalStateException(e); }
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
