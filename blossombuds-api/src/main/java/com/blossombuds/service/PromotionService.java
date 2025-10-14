package com.blossombuds.service;

import com.blossombuds.domain.Coupon;
import com.blossombuds.domain.CouponRedemption;
import com.blossombuds.domain.Order;
import com.blossombuds.dto.CouponRedemptionDto;
import com.blossombuds.repository.CouponRedemptionRepository;
import com.blossombuds.repository.CouponRepository;
import com.blossombuds.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Optional;

/** Application service for validating/applying coupons and recording redemptions. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PromotionService {

    private final CouponRepository couponRepo;
    private final CouponRedemptionRepository redemptionRepo;
    private final OrderRepository orderRepo;

    // ───────────────────────────────
    // Public API
    // ───────────────────────────────

    /** Returns an active coupon by code, if present. */
    public Optional<Coupon> getActiveCoupon(String code) {
        String norm = normalize(code);
        if (norm == null || norm.isBlank()) return Optional.empty();
        return couponRepo.findByCodeAndActiveTrue(norm);
    }

    /** Computes discount for a coupon against an order total (does NOT persist). */
    public BigDecimal previewDiscount(String code, Long customerId, BigDecimal orderTotal) {
        Coupon c = couponRepo.findByCodeAndActiveTrue(requireNormalize(code))
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found or inactive"));
        validateUsageAndWindow(c, customerId);
        validateMinTotal(c, orderTotal);
        return computeDiscount(c, orderTotal);
    }

    /** Applies a coupon to an order, updates order totals, and records a redemption. */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public CouponRedemption applyToOrder(String code, Long orderId, Long customerId, String actor) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");

        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
        if (customerId == null) customerId = order.getCustomerId();

        Coupon c = couponRepo.findByCodeAndActiveTrue(requireNormalize(code))
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found or inactive"));

        // Validate business rules against the current order/customer
        validateUsageAndWindow(c, customerId);
        validateMinTotal(c, order.getGrandTotal());

        // Compute discount (capped if needed)
        BigDecimal discount = computeDiscount(c, order.getGrandTotal());

        // Update order totals (grandTotal = itemsSubtotal + shippingFee - discount, not below zero)
        BigDecimal itemsSubtotal = nvl(order.getItemsSubtotal());
        BigDecimal shipping = nvl(order.getShippingFee());
        BigDecimal newGrand = itemsSubtotal.add(shipping).subtract(nvl(discount));
        if (newGrand.signum() < 0) newGrand = BigDecimal.ZERO;

        order.setDiscountTotal(discount);
        order.setGrandTotal(newGrand.setScale(2, RoundingMode.HALF_UP));
        orderRepo.save(order);

        // Persist redemption
        CouponRedemption r = new CouponRedemption();
        r.setCoupon(c);
        r.setOrder(order);
        r.setCustomerId(customerId);
        r.setRedeemedAt(OffsetDateTime.now());
        r.setActive(Boolean.TRUE);
        r.setCreatedBy(actor);
        r.setCreatedAt(OffsetDateTime.now());
        return redemptionRepo.save(r);
    }

    /** Soft-deactivates a redemption record (useful on cancel/refund). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void revokeRedemption(Long redemptionId, String actor) {
        if (redemptionId == null) throw new IllegalArgumentException("redemptionId is required");
        CouponRedemption r = redemptionRepo.findById(redemptionId)
                .orElseThrow(() -> new IllegalArgumentException("Redemption not found: " + redemptionId));
        r.setActive(Boolean.FALSE);
        r.setModifiedBy(actor);
        r.setModifiedAt(OffsetDateTime.now());
    }

    // ───────────────────────────────
    // Internal helpers
    // ───────────────────────────────

    /** Normalizes a coupon code for lookup (trim + upper). */
    private String normalize(String code) {
        if (code == null) return null;
        return code.trim().toUpperCase(Locale.ROOT);
    }

    /** Normalizes a coupon code and ensures it's non-blank. */
    private String requireNormalize(String code) {
        String n = normalize(code);
        if (n == null || n.isBlank()) {
            throw new IllegalArgumentException("Coupon code is required");
        }
        return n;
    }

    /** Throws if coupon is outside validity window or usage limits. */
    private void validateUsageAndWindow(Coupon c, Long customerId) {
        OffsetDateTime now = OffsetDateTime.now();

        if (c.getValidFrom() != null && now.isBefore(c.getValidFrom())) {
            throw new IllegalArgumentException("Coupon not yet valid");
        }
        if (c.getValidTo() != null && now.isAfter(c.getValidTo())) {
            throw new IllegalArgumentException("Coupon expired");
        }

        if (c.getUsageLimit() != null) {
            long used = redemptionRepo.countByCoupon_Id(c.getId());
            if (used >= c.getUsageLimit()) {
                throw new IllegalArgumentException("Coupon usage limit reached");
            }
        }
        if (c.getPerCustomerLimit() != null && customerId != null) {
            long usedByCustomer = redemptionRepo.countByCoupon_IdAndCustomerId(c.getId(), customerId);
            if (usedByCustomer >= c.getPerCustomerLimit()) {
                throw new IllegalArgumentException("Per-customer usage limit reached");
            }
        }
    }

    /** Throws if order total is below coupon's minimum. */
    private void validateMinTotal(Coupon c, BigDecimal orderTotal) {
        if (c.getMinOrderTotal() != null) {
            if (orderTotal == null || orderTotal.compareTo(c.getMinOrderTotal()) < 0) {
                throw new IllegalArgumentException("Order total below minimum for this coupon");
            }
        }
    }

    /** Calculates discount amount based on type/value and caps by maxDiscountAmount. */
    private BigDecimal computeDiscount(Coupon c, BigDecimal orderTotal) {
        if (orderTotal == null) orderTotal = BigDecimal.ZERO;

        String type = (c.getDiscountType() == null) ? "" : c.getDiscountType().trim().toUpperCase(Locale.ROOT);
        BigDecimal val = (c.getDiscountValue() == null) ? BigDecimal.ZERO : c.getDiscountValue();

        BigDecimal discount;
        switch (type) {
            case "PERCENT" -> discount = orderTotal.multiply(val).movePointLeft(2); // orderTotal * (val/100)
            case "FLAT"    -> discount = val;
            default        -> throw new IllegalArgumentException("Unsupported discount type: " + c.getDiscountType());
        }

        if (c.getMaxDiscountAmount() != null && discount.compareTo(c.getMaxDiscountAmount()) > 0) {
            discount = c.getMaxDiscountAmount();
        }
        if (discount.signum() < 0) discount = BigDecimal.ZERO;

        return discount.setScale(2, RoundingMode.HALF_UP);
    }

    /** Null-coalescing BigDecimal → zero. */
    private static BigDecimal nvl(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
