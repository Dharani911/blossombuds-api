package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Represents a discount coupon that can be applied to orders. */
@SQLDelete(sql = "UPDATE coupons SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "coupons")
public class Coupon {

    /** Surrogate primary key for coupons. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique code customers enter at checkout (e.g., BBNEW10). */
    @Column(name = "code", length = 40, unique = true, nullable = false)
    private String code;

    /** Human-friendly label/description for internal use. */
    @Column(name = "title", length = 120)
    private String title;

    /** Flat or percentage as free text (kept simple to match DB); e.g., "PERCENT", "FLAT". */
    @Column(name = "discount_type", length = 20)
    private String discountType;

    /** Discount value (percent or amount based on type). */
    @Column(name = "discount_value", precision = 12, scale = 2)
    private BigDecimal discountValue;

    /** Minimum order total required to apply this coupon. */
    @Column(name = "min_order_total", precision = 12, scale = 2)
    private BigDecimal minOrderTotal;

    /** Optional maximum discount cap for percentage coupons. */
    @Column(name = "max_discount_amount", precision = 12, scale = 2)
    private BigDecimal maxDiscountAmount;

    /** Start of validity window (inclusive). */
    @Column(name = "valid_from")
    private OffsetDateTime validFrom;

    /** End of validity window (inclusive). */
    @Column(name = "valid_to")
    private OffsetDateTime validTo;

    /** Global usage limit across all customers (null = unlimited). */
    @Column(name = "usage_limit")
    private Integer usageLimit;

    /** Per-customer usage limit (null = unlimited). */
    @Column(name = "per_customer_limit")
    private Integer perCustomerLimit;

    /** Soft-visibility/activation flag. */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Audit: created by whom. */
    @Column(name = "created_by", length = 120)
    private String createdBy;

    /** Audit: when created. */
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    /** Audit: last modifier. */
    @Column(name = "modified_by", length = 120)
    private String modifiedBy;

    /** Audit: when modified. */
    @Column(name = "modified_at")
    private OffsetDateTime modifiedAt;
}
