package com.blossombuds.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Request/response models for auth. */
public class AuthDto {
    @Data
    public static class LoginRequest {
        @NotBlank private String username;
        @NotBlank private String password;
    }
    @Data
    public static class TokenResponse {
        private final String token;
    }
}
