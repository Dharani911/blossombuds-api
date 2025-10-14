package com.blossombuds.web;

import com.blossombuds.dto.CustomerAuthDtos.CustomerLoginRequest;
import com.blossombuds.dto.CustomerAuthDtos.CustomerTokenResponse;
import com.blossombuds.dto.CustomerAuthDtos.RegisterRequest;
import com.blossombuds.service.CustomerAuthService;
import com.blossombuds.service.PasswordResetService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/** Public endpoints: customer register, verify email, login, password reset. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/customers/auth")
@Validated
public class CustomerAuthController {

    private final CustomerAuthService auth;
    private final PasswordResetService passwordResetService;

    /** Register customer, send verification email, return a customer JWT. */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerTokenResponse register(@Valid @RequestBody RegisterRequest req) {
        String token = auth.register(req);
        return new CustomerTokenResponse(token);
    }

    /** Verify email with token sent via email (public). */
    @PostMapping("/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verify(@RequestParam("token") String token) {
        auth.verifyEmail(token);
    }

    /** Customer login → returns JWT. */
    @PostMapping("/login")
    public CustomerTokenResponse login(@Valid @RequestBody CustomerLoginRequest req) {
        return new CustomerTokenResponse(auth.login(req));
    }

    // ---------- Password reset (public) ----------

    /** Starts a password reset by issuing a token and emailing the link (idempotent). */
    @PostMapping("/password-reset/request")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void requestPasswordReset(@Valid @RequestBody PasswordResetRequest req) {
        passwordResetService.requestReset(req.getEmail());
    }

    /** Confirms a password reset using token + new password. */
    @PostMapping("/password-reset/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmPasswordReset(@Valid @RequestBody PasswordResetConfirm req) {
        passwordResetService.confirmReset(req.getToken(), req.getNewPassword());
    }

    // ---------- DTOs ----------

    @Data
    public static class PasswordResetRequest {
        @NotBlank @Email
        private String email;
    }

    @Data
    public static class PasswordResetConfirm {
        @NotBlank
        private String token;
        @NotBlank @Size(min = 8, message = "Password must be at least 8 characters")
        private String newPassword;
    }
}
