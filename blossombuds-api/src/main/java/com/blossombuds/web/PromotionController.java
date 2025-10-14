package com.blossombuds.web;

import com.blossombuds.domain.Coupon;
import com.blossombuds.domain.CouponRedemption;
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
import java.util.Map;
import java.util.Optional;

/** HTTP endpoints for coupon preview/apply/revoke. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/promotions")
@Validated
public class PromotionController {

    private final PromotionService promos;

    /** Fetch an active coupon by code (public). */
    @GetMapping("/coupons/{code}")
    public Coupon getCoupon(@PathVariable String code) {
        Optional<Coupon> c = promos.getActiveCoupon(code);
        return c.orElseThrow(() -> new IllegalArgumentException("Coupon not found or inactive"));
    }

    /** Preview discount for a given coupon and order total (public, no persistence). */
    @PostMapping("/coupons/{code}/preview")
    public Map<String, Object> preview(@PathVariable String code,
                                       @Valid @RequestBody PreviewRequest body) {
        BigDecimal amount = promos.previewDiscount(code, body.getCustomerId(), body.getOrderTotal());
        return Map.of("code", code.toUpperCase(),
                "orderTotal", body.getOrderTotal(),
                "discount", amount);
    }

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

    // ── DTOs ──────────────────────────────────────────────────────────────────

    @Data
    public static class PreviewRequest {
        @NotNull @Min(1) private Long customerId;
        @NotNull private BigDecimal orderTotal;
    }

    @Data
    public static class ApplyRequest {
        @NotNull @Min(1) private Long orderId;
        // optional; falls back to order.customer_id in service
        private Long customerId;
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    private String actor(Authentication auth) {
        return (auth != null && auth.getName() != null) ? auth.getName() : "system";
    }
}
