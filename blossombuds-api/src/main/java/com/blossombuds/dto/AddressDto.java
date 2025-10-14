package com.blossombuds.dto;

import lombok.Data;

/** DTO for a customer’s postal address. */
@Data
public class AddressDto {
    private Long id;
    private Long customerId;
    private String name;
    private String phone;
    private String line1;
    private String line2;
    private Long districtId;
    private Long stateId;
    private String pincode;
    private Long countryId;
    private Boolean isDefault;   // per your table
    private Boolean active;
}
