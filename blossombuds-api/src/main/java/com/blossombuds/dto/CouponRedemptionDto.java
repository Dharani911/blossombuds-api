package com.blossombuds.dto;

import lombok.Data;
import java.time.OffsetDateTime;

/** DTO for coupon redemption records. */
@Data
public class CouponRedemptionDto {
    private Long id;
    private Long couponId;
    private Long orderId;
    private Long customerId;
    private OffsetDateTime redeemedAt;
    private Boolean active;
}
