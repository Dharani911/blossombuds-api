package com.blossombuds.dto;

import lombok.Data;

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
    /** Active flag (defaults to true on create). */
    private Boolean active;
}
