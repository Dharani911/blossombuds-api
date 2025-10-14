package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.OffsetDateTime;

/** Records a single use of a coupon against an order. */
@SQLDelete(sql = "UPDATE coupon_redemptions SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "coupon_redemptions")
public class CouponRedemption {

    /** Surrogate primary key for coupon redemptions. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Coupon that was redeemed. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coupon_id", nullable = false)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Coupon coupon;

    /** Order this redemption is associated with. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Order order;

    /** Optional customer id snapshot for per-customer limits (kept as number). */
    @Column(name = "customer_id")
    private Long customerId;

    /** When the coupon was redeemed. */
    @Column(name = "redeemed_at")
    private OffsetDateTime redeemedAt;

    /** Soft-visibility flag for this redemption record. */
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
