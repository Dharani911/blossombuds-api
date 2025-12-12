package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Represents a discount coupon that can be applied to orders. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "coupons")
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE coupons SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
public class Coupon {

    /** Surrogate primary key for coupons. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique code customers enter at checkout (e.g., BBNEW10). */
    @Column(name = "code", length = 40, unique = true)
    private String code;

    /**
     * Not persisted: UI/DTO display only (column not present in DB).
     */
    @Transient
    private String title;

    /** "PERCENT" or "FLAT" — DB column is 'type'. */
    @Column(name = "type", length = 10)
    private String discountType;

    /** Discount value (percent if type=PERCENT, flat amount if type=FLAT) — DB column is 'amount'. */
    @Column(name = "amount", precision = 12, scale = 2)
    private BigDecimal discountValue;

    /** Minimum order total required — DB column is 'min_order_value'. */
    @Column(name = "min_order_value", precision = 12, scale = 2)
    private BigDecimal minOrderTotal;

    /** Minimum number of items required — DB column is 'min_items'. */
    @Column(name = "min_items")
    private Integer minItems;

    /** Start of validity window (inclusive) — DB column is 'starts_at'. */
    @Column(name = "starts_at")
    private OffsetDateTime validFrom;

    /** End of validity window (inclusive) — DB column is 'ends_at'. */
    @Column(name = "ends_at")
    private OffsetDateTime validTo;

    /** Global usage limit across all customers (null = unlimited). */
    @Column(name = "usage_limit")
    private Integer usageLimit;

    /** Per-customer usage limit (null = unlimited). */
    @Column(name = "per_customer_limit")
    private Integer perCustomerLimit;

    /** Soft-delete flag (when false, record is considered deleted). */
    @Column(name = "active", nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Visibility flag (when false, coupon is hidden from customers but visible to admin). */
    @Column(name = "visible", nullable = false)
    private Boolean visible = Boolean.TRUE;

    /** Audit: created by whom. */
    @CreatedBy
    @Column(name = "created_by", length = 120)
    private String createdBy;

    /** Audit: when created. */
    @Column(name = "created_at")
    @CreatedDate
    private LocalDateTime createdAt;

    /** Audit: last modifier. */
    @Column(name = "modified_by", length = 120)
    @LastModifiedBy
    private String modifiedBy;

    /** Audit: when modified. */
    @Column(name = "modified_at")
    @LastModifiedDate
    private LocalDateTime modifiedAt;
}
