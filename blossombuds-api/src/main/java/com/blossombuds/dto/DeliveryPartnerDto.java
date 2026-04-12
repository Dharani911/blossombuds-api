package com.blossombuds.dto;

import lombok.Data;

import java.math.BigDecimal;

/** DTO for delivery/courier partners. */
@Data
public class DeliveryPartnerDto {
    private Long id;
    /** Unique partner code/key (e.g., "BLUEDART"). */
    private String code;
    /** Display name (e.g., "Blue Dart"). */
    private String name;
    /** URL template for tracking, e.g. https://track.example.com/{trackingNumber} */
    private String trackingUrlTemplate;
    private BigDecimal fixedFeeAmount;
    private Boolean overrideFreeShipping;
    /** Active flag (defaults to true on create). */
    private Boolean active;
    /** Visibility flag — when false, partner is hidden from customers but visible to admin. */
    private Boolean visible;
}
