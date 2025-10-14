package com.blossombuds.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

public class CustomerAuthDtos {

    @Data
    public static class RegisterRequest {
        @NotBlank private String name;
        @Email @NotBlank private String email;
        @NotBlank private String password;
        private String phone; // optional
    }

    @Data
    public static class CustomerLoginRequest {
        @NotBlank private String email;
        @NotBlank private String password;
    }

    @Data
    public static class CustomerTokenResponse {
        private final String token;
    }
}
