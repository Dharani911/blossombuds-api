package com.blossombuds.repository;

import com.blossombuds.domain.CouponRedemption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Repository for coupon redemption records. */
public interface CouponRedemptionRepository extends JpaRepository<CouponRedemption, Long> {

    /** Lists redemptions for a given order. */
    List<CouponRedemption> findByOrder_Id(Long orderId);

    /** Total times a coupon was redeemed (for global limits). */
    long countByCoupon_Id(Long couponId);

    /** Total times a coupon was redeemed by a customer (for per-customer limits). */
    long countByCoupon_IdAndCustomerId(Long couponId, Long customerId);
}
