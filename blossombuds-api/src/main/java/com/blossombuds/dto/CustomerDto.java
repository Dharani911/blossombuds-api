package com.blossombuds.dto;

import lombok.Data;

/** DTO for customer account. */
@Data
public class CustomerDto {
    private Long id;
    private String fullName;
    private String email;
    private String phone;
    private Boolean active;
}
