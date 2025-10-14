package com.blossombuds.dto;

import lombok.Data;

/** DTO for delivery/courier partners. */
@Data
public class DeliveryPartnerDto {
    private Long id;
    private String slug;
    private String name;
    private String trackingUrlTemplate;
    private String supportEmail;
    private String supportPhone;
    private Boolean active;
}
