package com.blossombuds.dto;

import lombok.Data;

/** DTO for back-office admin (no password hash exposure). */
@Data
public class AdminDto {
    private Long id;
    private String username;
    private String email;
    private String displayName;
    private Boolean enabled;
    private Boolean active;
}
