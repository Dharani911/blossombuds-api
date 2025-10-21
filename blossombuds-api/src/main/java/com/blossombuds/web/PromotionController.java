package com.blossombuds.web;

import com.blossombuds.domain.Coupon;
import com.blossombuds.domain.CouponRedemption;
import com.blossombuds.dto.CouponDto;
import com.blossombuds.service.PromotionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** HTTP endpoints for coupon CRUD + preview/apply/revoke. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/promotions")
@Validated
public class PromotionController {

    private final PromotionService promos;

    // ─────────────────────────────────────────────────────────────────────────
    // Public: lookup + preview
    // ─────────────────────────────────────────────────────────────────────────

    /** Fetch an active coupon by code (public). */
    @GetMapping("/coupons/{code}")
    public CouponDto getActiveCouponByCode(@PathVariable String code) {
        Optional<Coupon> c = promos.getActiveCoupon(code);
        return c.map(this::toDto)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found or inactive"));
    }

    /** Preview discount for a given coupon and order total (public, no persistence). */
    @PostMapping("/coupons/{code}/preview")
    public Map<String, Object> preview(@PathVariable String code,
                                       @Valid @RequestBody PreviewRequest body) {
        BigDecimal amount = promos.previewDiscount(code, body.getCustomerId(), body.getOrderTotal(), body.getItemsCount());
        return Map.of(
                "code", code == null ? null : code.trim().toUpperCase(Locale.ROOT),
                "orderTotal", body.getOrderTotal(),
                "discount", amount
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin: apply/revoke (operational)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Apply a coupon to an order and record a redemption row (admin/internal).
     * For customer checkout, do this on the server during your payment flow.
     */
    @PostMapping("/coupons/{code}/apply")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public CouponRedemption apply(@PathVariable String code,
                                  @Valid @RequestBody ApplyRequest body,
                                  Authentication auth) {
        return promos.applyToOrder(code, body.getOrderId(), body.getCustomerId(), actor(auth));
    }

    /** Soft-revoke a redemption (admin). */
    @PostMapping("/redemptions/{redemptionId}/revoke")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable @Min(1) Long redemptionId, Authentication auth) {
        promos.revokeRedemption(redemptionId, actor(auth));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin: Coupon CRUD
    // ─────────────────────────────────────────────────────────────────────────

    /** List all coupons (admin). */
    @GetMapping("/admin/coupons")
    @PreAuthorize("hasRole('ADMIN')")
    public List<CouponDto> listCoupons() {
        return promos.listCoupons();
    }

    /** Get coupon by id (admin). */
    @GetMapping("/admin/coupons/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CouponDto getCoupon(@PathVariable @Min(1) Long id) {
        return promos.getCoupon(id);
    }

    /** Create coupon (admin). */
    @PostMapping("/admin/coupons")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public CouponDto createCoupon(@Valid @RequestBody CouponDto dto, Authentication auth) {
        return promos.createCoupon(dto);
    }

    /** Update coupon (admin). */
    @PutMapping("/admin/coupons/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CouponDto updateCoupon(@PathVariable @Min(1) Long id,
                                  @Valid @RequestBody CouponDto dto,
                                  Authentication auth) {
        return promos.updateCoupon(id, dto);
    }

    /** Toggle coupon active flag (admin). */
    @PostMapping("/admin/coupons/{id}/active")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setCouponActive(@PathVariable @Min(1) Long id,
                                @RequestParam("active") boolean active) {
        promos.setCouponActive(id, active);
    }

    // ── DTOs for request bodies ──────────────────────────────────────────────

    @Data
    public static class PreviewRequest {
        @NotNull @Min(1) private Long customerId;
        @NotNull private BigDecimal orderTotal;
        private Integer itemsCount;
    }

    @Data
    public static class ApplyRequest {
        @NotNull @Min(1) private Long orderId;
        // optional; falls back to order.customer_id in service if null
        private Long customerId;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String actor(Authentication auth) {
        return (auth != null && auth.getName() != null) ? auth.getName() : "system";
    }

    /** Local mapper to avoid exposing entities in API. */
    private CouponDto toDto(Coupon c) {
        CouponDto dto = new CouponDto();
        dto.setId(c.getId());
        dto.setCode(c.getCode());
        dto.setDiscountType(c.getDiscountType());          // maps to 'type'
        dto.setDiscountValue(c.getDiscountValue());        // maps to 'amount'
        dto.setMinOrderTotal(c.getMinOrderTotal());        // 'min_order_value'
        dto.setMinItems(c.getMinItems());                  // 'min_items'
        dto.setValidFrom(c.getValidFrom());                // 'starts_at'
        dto.setValidTo(c.getValidTo());                    // 'ends_at'
        dto.setUsageLimit(c.getUsageLimit());              // 'usage_limit'
        dto.setPerCustomerLimit(c.getPerCustomerLimit());  // 'per_customer_limit'
        dto.setActive(c.getActive());
        return dto;
    }
}
