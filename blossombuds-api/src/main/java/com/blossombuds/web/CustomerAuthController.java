package com.blossombuds.web;

import com.blossombuds.dto.CustomerAuthDtos.CustomerLoginRequest;
import com.blossombuds.dto.CustomerAuthDtos.CustomerTokenResponse;
import com.blossombuds.dto.CustomerAuthDtos.RegisterRequest;
import com.blossombuds.service.CustomerAuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * Public endpoints: customer register, email verification via OTP, login, password reset via OTP.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/customers/auth")
@Validated
public class CustomerAuthController {

    private final CustomerAuthService auth;

    /** Register customer, store password, send verification OTP to email. */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public void register(@Valid @RequestBody RegisterRequest req) {
        auth.register(req);
    }

    /**
     * Verify email using an OTP sent to the customer's email.
     * Frontend: call after registration or from "verify email" screen.
     * Returns 204 No Content on success.
     */
    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody VerifyEmailOtpRequest req) {
        auth.verifyEmailOtp(req.getEmail(), req.getCode());
    }

    /**
     * Verify email using OTP and return JWT token for auto-login.
     * Frontend: call after registration to verify and login in one step.
     */
    @PostMapping("/verify-email-otp")
    public CustomerTokenResponse verifyEmailAndLogin(@Valid @RequestBody VerifyEmailOtpRequest req) {
        return new CustomerTokenResponse(auth.verifyEmailOtpAndLogin(req.getEmail(), req.getCode()));
    }

    /** Customer login → returns JWT (email + password flow). */
    @PostMapping("/login")
    public CustomerTokenResponse login(@Valid @RequestBody CustomerLoginRequest req) {
        return new CustomerTokenResponse(auth.login(req));
    }

    /**
     * Resend verification OTP to email.
     * Frontend: "Resend code" on verify screen.
     */
    @PostMapping("/resend-verification")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendVerification(@Valid @RequestBody ResendVerificationRequest req) {
        auth.resendVerificationEmail(req.getEmail());
    }

    // ---------- Password reset via OTP ----------

    /**
     * Starts a password reset by sending an OTP to the email.
     * Frontend: user enters email → call this → show "enter code + new password" screen.
     */
    @PostMapping("/password-reset/request")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void requestPasswordReset(@Valid @RequestBody PasswordResetRequest req) {
        auth.startPasswordReset(req.getEmail());
    }

    /**
     * Completes password reset with email + OTP + new password.
     */
    @PostMapping("/password-reset/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmPasswordReset(@Valid @RequestBody PasswordResetConfirm req) {
        auth.completePasswordReset(req.getEmail(), req.getCode(), req.getNewPassword());
    }

    @PostMapping("/google-login")
    public CustomerTokenResponse googleLogin(@Valid @RequestBody GoogleLoginRequest req) {
        String jwtToken = auth.loginWithGoogle(req.getIdToken());
        return new CustomerTokenResponse(jwtToken);
    }

    @Data
    public static class GoogleLoginRequest {
        @NotBlank
        private String idToken;
    }

    // ---------- DTOs ----------

    @Data
    public static class VerifyEmailOtpRequest {
        @NotBlank
        @Email
        private String email;

        @NotBlank
        @Size(min = 4, max = 10)  // 6-digit, but flexible
        private String code;
    }

    @Data
    public static class ResendVerificationRequest {
        @NotBlank
        @Email
        private String email;
    }

    @Data
    public static class PasswordResetRequest {
        @NotBlank
        @Email
        private String email;
    }

    @Data
    public static class PasswordResetConfirm {
        @NotBlank
        @Email
        private String email;

        @NotBlank
        @Size(min = 4, max = 10)
        private String code;

        @NotBlank
        @Size(min = 8, message = "Password must be at least 8 characters")
        private String newPassword;
    }
}
