package com.blossombuds.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

public class CustomerAuthDtos {

    @Data
    public static class RegisterRequest {
        @NotBlank private String name;
        @Email private String email;   // optional if phone is provided
        private String password;       // optional for phone-only signup
        private String phone;          // optional if email is provided
        private Boolean whatsAppOptIn; // consent to receive WhatsApp promotions
        private Boolean smsOptIn;      // consent to receive SMS promotions
    }

    @Data
    public static class CustomerLoginRequest {
        @NotBlank private String identifier; // email or phone (+91XXXXXXXXXX)
        @NotBlank private String password;
    }

    @Data
    public static class CustomerTokenResponse {
        private final String token;
    }
}
