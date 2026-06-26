package com.blossombuds.dto;

import lombok.Data;

/** DTO for delivery/courier partners. */
@Data
public class DeliveryPartnerDto {
    private Long id;
    private String code;
    private String name;
    private String trackingUrlTemplate;
    private Boolean overrideFreeShipping;
    private Boolean active;
    private Boolean visible;
}
