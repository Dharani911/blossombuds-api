package com.blossombuds.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** DTO for coupon definitions and status (aligned with bb_app.coupons). */
@Data
public class CouponDto {
    private Long id;

    /** Unique code (e.g., WELCOME10). */
    private String code;

    /** "PERCENT" or "FLAT" — maps to column 'type'. */
    private String discountType;

    /** Percent (if PERCENT) or flat amount (if FLAT) — maps to column 'amount'. */
    private BigDecimal discountValue;

    /** Minimum order total required — maps to 'min_order_value'. */
    private BigDecimal minOrderTotal;

    /** Minimum number of items required — maps to 'min_items'. */
    private Integer minItems;

    /** Validity window — maps to 'starts_at' / 'ends_at'. */
    private OffsetDateTime validFrom;
    private OffsetDateTime validTo;

    /** Global usage cap — maps to 'usage_limit'. */
    private Integer usageLimit;

    /** Per-customer usage cap — maps to 'per_customer_limit'. */
    private Integer perCustomerLimit;

    /** Active flag — maps to 'active'. */
    private Boolean active;


}
