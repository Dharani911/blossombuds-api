package com.blossombuds.service;

import com.blossombuds.domain.Coupon;
import com.blossombuds.domain.CouponRedemption;
import com.blossombuds.domain.Order;
import com.blossombuds.dto.CouponDto;
import com.blossombuds.repository.CouponRedemptionRepository;
import com.blossombuds.repository.CouponRepository;
import com.blossombuds.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Coupons: create/update (admin), preview & apply (customer/admin), and redemption recording.
 * Now enforces min items (min_items) in addition to min order total.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PromotionService {

    private final CouponRepository couponRepo;
    private final CouponRedemptionRepository redemptionRepo;
    private final OrderRepository orderRepo;

    /* ========================= ADMIN APIs ========================= */

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CouponDto createCoupon(CouponDto dto) {
        log.info("[COUPON][CREATE] Creating coupon with code={}", dto.getCode());

        Coupon c = new Coupon();
        applyCouponFields(c, dto, true);
        c = couponRepo.save(c);
        log.info("[COUPON][CREATE] Created coupon id={} code={}", c.getId(), c.getCode());
        return toDto(c);
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CouponDto updateCoupon(Long id, CouponDto dto) {
        log.info("[COUPON][UPDATE] Updating coupon id={}", id);
        Coupon c = couponRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found: " + id));
        applyCouponFields(c, dto, false);
        log.info("[COUPON][UPDATE] Updated coupon id={} newCode={}", id, c.getCode());
        return toDto(c);
    }

    public CouponDto getCoupon(Long id) {
        log.info("[COUPON][FETCH] Fetching coupon id={}", id);
        return toDto(couponRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found: " + id)));
    }

    public List<CouponDto> listCoupons() {
        log.info("[COUPON][LIST] Listing all coupons"); return couponRepo.findAll().stream().map(this::toDto).toList();
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void setCouponActive(Long id, boolean active) {
        log.info("[COUPON][ACTIVATE] Setting coupon id={} active={}", id, active);

        Coupon c = couponRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found: " + id));
        c.setActive(active);
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void setCouponVisible(Long id, boolean visible) {
        log.info("[COUPON][VISIBLE] Setting coupon id={} visible={}", id, visible);

        Coupon c = couponRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found: " + id));
        c.setVisible(visible);
    }

    /* =================== Mapping & validation =================== */

    private void applyCouponFields(Coupon c, CouponDto dto, boolean isCreate) {
        // Code (store uppercase; enforce uniqueness case-insensitively)
        if (dto.getCode() != null) {
            String codeUp = normalize(dto.getCode());
            if (isCreate) {
                if (couponRepo.existsByCodeIgnoreCase(codeUp))
                    throw new IllegalArgumentException("Coupon code already exists: " + codeUp);
            } else if (!codeUp.equalsIgnoreCase(nvl(c.getCode()))
                    && couponRepo.existsByCodeIgnoreCase(codeUp)) {
                throw new IllegalArgumentException("Coupon code already exists: " + codeUp);
            }
            c.setCode(codeUp);
        } else if (isCreate) {
            throw new IllegalArgumentException("Coupon code is required");
        }

       // if (dto.getTitle() != null) c.setTitle(dto.getTitle().trim());

        if (dto.getDiscountType() != null) {
            String t = dto.getDiscountType().trim().toUpperCase(Locale.ROOT);
            if (!t.equals("PERCENT") && !t.equals("FLAT"))
                throw new IllegalArgumentException("discountType must be PERCENT or FLAT");
            c.setDiscountType(t); // maps to "type"
        } else if (isCreate) {
            throw new IllegalArgumentException("discountType is required");
        }

        if (dto.getDiscountValue() != null) {
            if (dto.getDiscountValue().signum() < 0)
                throw new IllegalArgumentException("discountValue must be >= 0");
            c.setDiscountValue(dto.getDiscountValue()); // maps to "amount"
        } else if (isCreate) {
            throw new IllegalArgumentException("discountValue is required");
        }

        // min_order_value
        if (dto.getMinOrderTotal() != null && dto.getMinOrderTotal().signum() < 0)
            throw new IllegalArgumentException("minOrderTotal must be >= 0");
        c.setMinOrderTotal(dto.getMinOrderTotal());

        // NEW: min_items
        if (dto.getMinItems() != null && dto.getMinItems() < 0)
            throw new IllegalArgumentException("minItems must be >= 0");
        c.setMinItems(dto.getMinItems());

        // validity window
        if (dto.getValidFrom() != null) c.setValidFrom(dto.getValidFrom()); // "starts_at"
        if (dto.getValidTo()   != null) c.setValidTo(dto.getValidTo());     // "ends_at"
        if (c.getValidFrom() != null && c.getValidTo() != null && c.getValidTo().isBefore(c.getValidFrom()))
            throw new IllegalArgumentException("validTo must be after validFrom");

        c.setUsageLimit(dto.getUsageLimit());
        c.setPerCustomerLimit(dto.getPerCustomerLimit());

        if (dto.getActive() != null) c.setActive(dto.getActive());
        else if (isCreate) c.setActive(Boolean.TRUE);

        if (dto.getVisible() != null) c.setVisible(dto.getVisible());
        else if (isCreate) c.setVisible(Boolean.TRUE);
    }

    private CouponDto toDto(Coupon c) {
        CouponDto dto = new CouponDto();
        dto.setId(c.getId());
        dto.setCode(c.getCode());

        dto.setDiscountType(c.getDiscountType());   // "type"
        dto.setDiscountValue(c.getDiscountValue()); // "amount"
        dto.setMinOrderTotal(c.getMinOrderTotal()); // "min_order_value"
        dto.setMinItems(c.getMinItems());           // "min_items"
        dto.setValidFrom(c.getValidFrom());         // "starts_at"
        dto.setValidTo(c.getValidTo());             // "ends_at"
        dto.setUsageLimit(c.getUsageLimit());
        dto.setPerCustomerLimit(c.getPerCustomerLimit());
        dto.setActive(c.getActive());
        dto.setVisible(c.getVisible());
        return dto;
    }

    private String nvl(String s) { return (s == null ? "" : s); }

    /* ======================= Public APIs ======================= */

    /** Returns a visible (customer-facing) coupon by code, if present. */
    public Optional<Coupon> getActiveCoupon(String code) {
        log.debug("[COUPON][LOOKUP] Looking up visible coupon for code={}", code);

        String norm = normalize(code);
        if (norm == null || norm.isBlank()) return Optional.empty();
        return couponRepo.findByCodeIgnoreCaseAndVisibleTrue(norm);
    }

    /**
     * Preview discount for a given order snapshot (does NOT persist).
     * Enforces validity window, usage limits (global & per-customer), min total, and min items.
     */
    public BigDecimal previewDiscount(String code, Long customerId, BigDecimal orderTotal, Integer itemsCount) {
        log.info("[COUPON][PREVIEW] Preview discount code={} customerId={} orderTotal={}",
                code, customerId, orderTotal);

        Coupon c = couponRepo.findByCodeIgnoreCaseAndVisibleTrue(requireNormalize(code))
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found or hidden"));
        validateUsageAndWindow(c, customerId);
        validateMinTotal(c, orderTotal);
        validateMinItems(c, itemsCount);
        BigDecimal discount = computeDiscount(c, orderTotal);

        log.info("[COUPON][PREVIEW] Discount computed={} for code={}", discount, code);
        return discount;
    }

    /**
     * Applies a coupon to an existing order: updates totals and records a redemption.
     */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public CouponRedemption applyToOrder(String code, Long orderId, Long customerId, String actor) {
        log.info("[COUPON][APPLY] Applying coupon={} orderId={} customerId={}", code, orderId, customerId);

        if (orderId == null) throw new IllegalArgumentException("orderId is required");

        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
        if (customerId == null) customerId = order.getCustomerId();

        Coupon c = couponRepo.findByCodeIgnoreCaseAndVisibleTrue(requireNormalize(code))
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found or hidden"));

        // enforce all conditions
        validateUsageAndWindow(c, customerId);
        validateMinTotal(c, order.getGrandTotal());
        validateMinItems(c, orderItemCount(order));

        // compute discount and re-total
        BigDecimal discount = computeDiscount(c, order.getGrandTotal());

        BigDecimal itemsSubtotal = nvl(order.getItemsSubtotal());
        BigDecimal shipping = nvl(order.getShippingFee());
        BigDecimal newGrand = itemsSubtotal.add(shipping).subtract(nvl(discount));
        if (newGrand.signum() < 0) newGrand = BigDecimal.ZERO;

        order.setDiscountTotal(discount);
        order.setGrandTotal(newGrand.setScale(2, RoundingMode.HALF_UP));
        orderRepo.save(order);

        // record redemption
        CouponRedemption r = new CouponRedemption();
        r.setCoupon(c);
        r.setOrder(order);
        r.setCustomerId(customerId);
        r.setAmountApplied(order.getDiscountTotal());
        r.setActive(Boolean.TRUE);
        //r.setCreatedBy(actor);
        //r.setCreatedAt(OffsetDateTime.now());
        r = redemptionRepo.save(r);

        log.info("[COUPON][APPLY] Applied successfully coupon={} orderId={} discount={}",
                code, orderId, discount);

        return r;
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void revokeRedemption(Long redemptionId, String actor) {
        log.info("[COUPON][REVOKE] Revoking redemption id={}", redemptionId);

        if (redemptionId == null) throw new IllegalArgumentException("redemptionId is required");
        CouponRedemption r = redemptionRepo.findById(redemptionId)
                .orElseThrow(() -> new IllegalArgumentException("Redemption not found: " + redemptionId));
        r.setActive(Boolean.FALSE);
        log.info("[COUPON][REVOKE] Redemption revoked id={}", redemptionId);
    }

    /* ======================= Internal helpers ======================= */

    /** Normalize lookup key (trim + upper). */
    private String normalize(String code) {
        if (code == null) return null;
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private String requireNormalize(String code) {
        String n = normalize(code);
        if (n == null || n.isBlank()) {
            throw new IllegalArgumentException("Coupon code is required");
        }
        return n;
    }

    /** Validity window and usage limits. */
    private void validateUsageAndWindow(Coupon c, Long customerId) {
        OffsetDateTime now = OffsetDateTime.now();

        if (c.getValidFrom() != null && now.isBefore(c.getValidFrom()))
            throw new IllegalArgumentException("Coupon not yet valid");

        if (c.getValidTo() != null && now.isAfter(c.getValidTo()))
            throw new IllegalArgumentException("Coupon expired");

        if (c.getUsageLimit() != null) {
            long used = redemptionRepo.countByCoupon_Id(c.getId()); // consider ActiveTrue variant if you support revokes
            if (used >= c.getUsageLimit())
                throw new IllegalArgumentException("Coupon usage limit reached");
        }
        if (c.getPerCustomerLimit() != null && customerId != null) {
            long usedByCustomer = redemptionRepo.countByCoupon_IdAndCustomerId(c.getId(), customerId); // consider ActiveTrue variant
            if (usedByCustomer >= c.getPerCustomerLimit())
                throw new IllegalArgumentException("Per-customer usage limit reached");
        }
    }

    /** Enforce minimum order total (min_order_value). */
    private void validateMinTotal(Coupon c, BigDecimal orderTotal) {
        if (c.getMinOrderTotal() != null) {
            if (orderTotal == null || orderTotal.compareTo(c.getMinOrderTotal()) < 0) {
                throw new IllegalArgumentException("Order total below minimum for this coupon");
            }
        }
    }

    /** Enforce minimum items (min_items). */
    private void validateMinItems(Coupon c, Integer itemsCount) {
        Integer minItems = c.getMinItems();
        if (minItems != null && minItems > 0) {
            int count = (itemsCount == null ? 0 : itemsCount);
            if (count < minItems) {
                throw new IllegalArgumentException("Minimum " + minItems + " item(s) required for this coupon");
            }
        }
    }

    /** Compute discount: PERCENT or FLAT. Clamp to not exceed order total. */
    private BigDecimal computeDiscount(Coupon c, BigDecimal orderTotal) {
        if (orderTotal == null) orderTotal = BigDecimal.ZERO;

        String type = (c.getDiscountType() == null) ? "" : c.getDiscountType().trim().toUpperCase(Locale.ROOT);
        BigDecimal val = (c.getDiscountValue() == null) ? BigDecimal.ZERO : c.getDiscountValue();

        BigDecimal discount = switch (type) {
            case "PERCENT" -> orderTotal.multiply(val).movePointLeft(2); // orderTotal * (val/100)
            case "FLAT"    -> val;
            default        -> throw new IllegalArgumentException("Unsupported discount type: " + c.getDiscountType());
        };

        if (discount.compareTo(orderTotal) > 0) discount = orderTotal; // cannot discount more than total
        if (discount.signum() < 0) discount = BigDecimal.ZERO;

        return discount.setScale(2, RoundingMode.HALF_UP);
    }

    /** Null-coalescing BigDecimal -> zero. */
    private static BigDecimal nvl(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    /**
     * Best-effort extraction of item count from Order. Tries common getters:
     * getItemsCount(), getTotalItems(), getItemsQuantity(), getQuantity() — returns 0 if none present.
     */
    private Integer orderItemCount(Order order) {
        if (order == null) return 0;
        Integer val = tryIntGetter(order, "getItemsCount");
        if (val != null) return val;
        val = tryIntGetter(order, "getTotalItems");
        if (val != null) return val;
        val = tryIntGetter(order, "getItemsQuantity");
        if (val != null) return val;
        val = tryIntGetter(order, "getQuantity");
        return val != null ? val : 0;
    }

    private Integer tryIntGetter(Order order, String getterName) {
        try {
            Method m = order.getClass().getMethod(getterName);
            Object o = m.invoke(order);
            if (o instanceof Integer i) return i;
            if (o instanceof Long l) return l.intValue();
        } catch (Exception ignored) {}
        return null;
    }
}
