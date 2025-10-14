package com.blossombuds.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** DTO for coupon definitions and status. */
@Data
public class CouponDto {
    private Long id;
    private String code;
    private String title;
    private String discountType;        // PERCENT | FLAT (per your spec)
    private BigDecimal discountValue;
    private BigDecimal minOrderTotal;
    private BigDecimal maxDiscountAmount;
    private OffsetDateTime validFrom;
    private OffsetDateTime validTo;
    private Integer usageLimit;
    private Integer perCustomerLimit;
    private Boolean active;
}
