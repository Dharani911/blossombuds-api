package com.blossombuds.service;

import com.blossombuds.domain.CheckoutIntent;
import com.blossombuds.domain.Country;
import com.blossombuds.domain.Customer;
import com.blossombuds.domain.Product;
import com.blossombuds.dto.OrderDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.repository.CheckoutIntentRepository;
import com.blossombuds.repository.CountryRepository;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.repository.ProductRepository;
import com.blossombuds.service.payments.RazorpayService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.RoundingMode;
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
    private final ProductRepository productRepo;
    private final SettingsService settingsService;
    private final DeliveryFeeRulesService deliveryFeeService;
    private static final BigDecimal GST_THRESHOLD_AMOUNT =
            BigDecimal.valueOf(10000).setScale(2, RoundingMode.HALF_UP);

    private static final BigDecimal GST_RATE_ABOVE_THRESHOLD =
            BigDecimal.valueOf(8).setScale(2, RoundingMode.HALF_UP);

    private static final BigDecimal GST_RATE_DEFAULT =
            BigDecimal.valueOf(10).setScale(2, RoundingMode.HALF_UP);
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
        assertAllItemsInStock(items);
        // International
        if (!isIndia(country)) {
            log.info("[CHECKOUT][INTL] Building WhatsApp URL for non-India destination");
            Customer c = (customerId == null) ? null : customerRepo.findById(customerId).orElse(null);
            String url = waBuilder.buildForOrderDraft(orderDraft, items, c);
            log.info("[CHECKOUT][INTL][OK] elapsedMs={}", java.time.Duration.between(t0, Instant.now()).toMillis());
            return Decision.whatsapp(url);
        }


        // India: validate shipping phone before touching DB or Razorpay
        validateShipPhone(orderDraft.getShipPhone());

        // India: backend-authoritative pricing before creating intent/Razorpay order
        applyBackendGstTotals(orderDraft, country);

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
    /** Ensures every checkout item refers to an active, visible, in-stock product. */
    private void assertAllItemsInStock(List<OrderItemDto> items) {
        for (OrderItemDto it : items) {
            if (it == null) continue;


            Long productId = it.getProductId();

            if (productId == null) {
                log.warn("[CHECKOUT][STOCK][FAIL] Missing productId in item");
                throw new IllegalArgumentException("Invalid item: missing productId");
            }

            Product p = productRepo.findById(productId)
                    .orElseThrow(() -> {
                        log.warn("[CHECKOUT][STOCK][FAIL] Product not found id={}", productId);
                        return new IllegalArgumentException("Product not found: " + productId);
                    });

            // Keep rules strict at checkout time
            if (Boolean.FALSE.equals(p.getActive())) {
                log.warn("[CHECKOUT][STOCK][FAIL] Product inactive id={} name='{}'", p.getId(), p.getName());
                throw new IllegalArgumentException("Product unavailable: " + p.getName());
            }
            if (Boolean.FALSE.equals(p.getVisible())) {
                log.warn("[CHECKOUT][STOCK][FAIL] Product not visible id={} name='{}'", p.getId(), p.getName());
                throw new IllegalArgumentException("Product unavailable: " + p.getName());
            }
            if (Boolean.FALSE.equals(p.getInStock())) {
                log.warn("[CHECKOUT][STOCK][FAIL] Out of stock id={} name='{}'", p.getId(), p.getName());
                throw new IllegalArgumentException("Out of stock: " + p.getName());
            }
        }

        log.info("[CHECKOUT][STOCK][OK] itemsCount={}", items.size());
    }

    // ---------- helpers ----------

    private void validateShipPhone(String phone) {
        if (phone == null || phone.isBlank()) {
            throw new IllegalArgumentException(
                "A phone number is required for delivery. Please enter a valid 10-digit Indian mobile number.");
        }
        String digits = phone.replaceAll("[^0-9]", "");
        if (digits.length() == 12 && digits.startsWith("91")) {
            digits = digits.substring(2);
        }
        if (digits.length() != 10 || !digits.matches("[6-9][0-9]{9}")) {
            throw new IllegalArgumentException(
                "\"" + phone + "\" is not a valid Indian mobile number. " +
                "Please enter a 10-digit number starting with 6, 7, 8, or 9 (e.g. 98765 43210).");
        }
    }
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
    private BigDecimal nvl(BigDecimal v) { return v == null ? BigDecimal.ZERO : v.setScale(2, java.math.RoundingMode.HALF_UP); }
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
    /** Returns true when GST is enabled for checkout calculations. */
    private boolean isGstEnabled() {
        String value = settingsService.safeGet("checkout.gst.enabled");
        return value == null || value.isBlank() || Boolean.parseBoolean(value.trim());
    }

    /** Reads GST rate from settings, defaulting to 10%.
    private BigDecimal gstRate() {
        String value = settingsService.safeGet("checkout.gst.rate");
        if (value == null || value.isBlank()) {
            return BigDecimal.valueOf(10).setScale(2, RoundingMode.HALF_UP);
        }

        try {
            BigDecimal rate = new BigDecimal(value.trim()).setScale(2, RoundingMode.HALF_UP);
            return rate.signum() < 0 ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : rate;
        } catch (NumberFormatException e) {
            log.warn("[CHECKOUT][GST] Invalid checkout.gst.rate='{}'. Using 10", value);
            return BigDecimal.valueOf(10).setScale(2, RoundingMode.HALF_UP);
        }
    }*/
    /** Returns the GST rate based on the taxable amount threshold. */
    /** Returns the GST rate based on the taxable amount threshold. */
    private BigDecimal gstRateForTaxableAmount(BigDecimal taxableAmount) {
        BigDecimal taxable = nvl(taxableAmount).setScale(2, RoundingMode.HALF_UP);

        if (!isGstEnabled()) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        if (taxable.compareTo(GST_THRESHOLD_AMOUNT) > 0) {
            return GST_RATE_ABOVE_THRESHOLD;
        }

        return GST_RATE_DEFAULT;
    }
    /** Applies backend-authoritative GST totals to the order draft before Razorpay order creation. */
    private void applyBackendGstTotals(OrderDto orderDraft, Country country) {
        BigDecimal itemsSubtotal = nvl(orderDraft.getItemsSubtotal());
        BigDecimal discountTotal = nvl(orderDraft.getDiscountTotal());
        if (discountTotal.signum() < 0) discountTotal = BigDecimal.ZERO;

        BigDecimal shippingFee = resolveCheckoutShippingFee(orderDraft, country, itemsSubtotal);

        BigDecimal taxableAmount = itemsSubtotal.subtract(discountTotal);
        if (taxableAmount.signum() < 0) taxableAmount = BigDecimal.ZERO;
        taxableAmount = taxableAmount.setScale(2, RoundingMode.HALF_UP);

        BigDecimal rate = gstRateForTaxableAmount(taxableAmount);

        BigDecimal gstAmount = taxableAmount
                .multiply(rate)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        BigDecimal grandTotal = taxableAmount
                .add(gstAmount)
                .add(shippingFee)
                .setScale(2, RoundingMode.HALF_UP);

        orderDraft.setShippingFee(shippingFee);
        orderDraft.setDiscountTotal(discountTotal);
        orderDraft.setTaxableAmount(taxableAmount);
        orderDraft.setGstRate(rate);
        orderDraft.setGstAmount(gstAmount);
        orderDraft.setGrandTotal(grandTotal);

        log.info("[CHECKOUT][GST] taxableAmount={} gstApplied={} gstAmount={} shipping={} grandTotal={}",
                taxableAmount, rate.signum() > 0, gstAmount, shippingFee, grandTotal);
    }

    /** Resolves checkout shipping fee in the same way as order creation. */
    private BigDecimal resolveCheckoutShippingFee(OrderDto orderDraft, Country country, BigDecimal itemsSubtotal) {
        if (country == null) {
            return BigDecimal.ZERO;
        }

        if (isIndia(country)) {
            BigDecimal fee = deliveryFeeService.computeFee(
                    itemsSubtotal,
                    orderDraft.getShipStateId(),
                    orderDraft.getShipDistrictId(),
                    orderDraft.getDeliveryPartnerId()
            );
            return fee == null || fee.signum() < 0 ? BigDecimal.ZERO : fee.setScale(2, RoundingMode.HALF_UP);
        }

        return nvl(orderDraft.getShippingFee());
    }
}
