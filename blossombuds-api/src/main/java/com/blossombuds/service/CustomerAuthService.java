package com.blossombuds.service;

import com.blossombuds.domain.AuthOtpToken;
import com.blossombuds.domain.Customer;
import com.blossombuds.domain.OtpChannel;
import com.blossombuds.domain.OtpPurpose;
import com.blossombuds.dto.CustomerAuthDtos.CustomerLoginRequest;
import com.blossombuds.dto.CustomerAuthDtos.RegisterRequest;
import com.blossombuds.repository.AuthOtpTokenRepository;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.security.JwtUtil;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;

/** Auth service for customers: register, email-verify via OTP, login, and password reset (issues CUSTOMER JWT). */
@Slf4j
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerAuthService {

    private final CustomerRepository customers;
    private final AuthOtpTokenRepository otpRepo;
    private final PasswordEncoder encoder;
    private final EmailService emailService;
    private final JwtUtil jwt;
    private final GoogleIdTokenVerifier googleVerifier;

    @Value("${app.frontend.baseUrl:}")
    private String frontendBase; // kept for future flows if needed

    private static final SecureRandom RNG = new SecureRandom();

    private static final OtpChannel CHANNEL_EMAIL = OtpChannel.EMAIL;

    private static final OtpPurpose PURPOSE_VERIFY_EMAIL = OtpPurpose.VERIFY_CONTACT;
    private static final OtpPurpose PURPOSE_FORGOT_PASSWORD = OtpPurpose.FORGOT_PASSWORD;


    private static final int OTP_VALID_MINUTES = 10;

    /** Registers a customer, stores password, and sends a verification OTP to their email. */
    @Transactional
    public void register(RegisterRequest req) {
        if (req == null) throw new IllegalArgumentException("RegisterRequest is required");
        String name = safeTrim(req.getName());
        String email = normalizeEmail(req.getEmail());
        String phone = safeTrim(req.getPhone());
        String rawPassword = safeTrim(req.getPassword());

        if (isBlank(name)) throw new IllegalArgumentException("Name is required");
        if (isBlank(email) && isBlank(phone)) throw new IllegalArgumentException("Email or Phone is required");
        if (isBlank(rawPassword)) throw new IllegalArgumentException("Password is required");

        // Uniqueness: email must be unused
        if (!isBlank(email)) {
            customers.findByEmail(email).ifPresent(c -> {
                throw new IllegalArgumentException("Email already registered");
            });
        }
        // Uniqueness: phone must be unused
        if (!isBlank(phone)) {
            customers.findByPhone(phone).ifPresent(c -> {
                throw new IllegalArgumentException("Phone already registered");
            });
        }

        // Create customer
        Customer c = new Customer();
        c.setName(name);
        c.setEmail(email);
        c.setPhone(phone);
        c.setPasswordHash(encoder.encode(rawPassword));
        c.setActive(true);
        c.setEmailVerified(false);
        customers.save(c);

        log.info("[CUSTOMER][REGISTER] New customer registered: email={}, phone={}, id={}", email, phone, c.getId());

        // Issue email verification OTP ONLY if email is present
        if (!isBlank(email)) {
            String otp = issueEmailOtp(c.getId(), email, PURPOSE_VERIFY_EMAIL);
            emailService.sendVerificationEmail(email, otp);
            log.info("[CUSTOMER][VERIFY_EMAIL_OTP] Verification OTP sent to: {}", email);
            log.info("[CUSTOMER][REGISTER] Registration completed, awaiting OTP verification for {}", email);
        } else {
            // If only phone, maybe we should auto-verify or send SMS (not implemented yet)
            // For now, we just log.
            log.info("[CUSTOMER][REGISTER] Registration completed via phone (no email OTP sent).");
        }
    }

    @Transactional
    public String loginWithGoogle(String idTokenString) {
        String token = safeTrim(idTokenString);
        if (isBlank(token)) {
            throw new IllegalArgumentException("Google ID token is required");
        }

        try {
            GoogleIdToken idToken = googleVerifier.verify(token);
            if (idToken == null) {
                throw new IllegalArgumentException("Invalid Google ID token");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();

            String sub = payload.getSubject(); // stable Google user ID
            String email = normalizeEmail((String) payload.getEmail());
            boolean emailVerified = Boolean.TRUE.equals(payload.getEmailVerified());
            String name = safeTrim((String) payload.get("name"));

            if (sub == null || sub.isBlank()) {
                throw new IllegalArgumentException("Google token missing subject");
            }

            // 1) Try find by googleSubject
            Customer c = customers.findByGoogleSubject(sub).orElse(null);

            // 2) If not found, try by email and link
            if (c == null && email != null) {
                c = customers.findByEmail(email).orElse(null);
                if (c != null) {
                    // Link this existing account to Google
                    if (c.getGoogleSubject() != null && !sub.equals(c.getGoogleSubject())) {
                        // Safety: email used with another Google account
                        log.warn("[CUSTOMER][GOOGLE] Email already linked to another Google account: {}", email);
                        throw new IllegalArgumentException("This email is already linked to another Google login.");
                    }
                    c.setGoogleSubject(sub);
                    c.setGoogleEmail(email);
                    if (emailVerified) {
                        c.setEmailVerified(true);
                    }
                }
            }

            // 3) If still null, create a new customer from Google profile
            if (c == null) {
                c = new Customer();
                c.setName(name != null && !name.isBlank() ? name : "Guest");
                c.setEmail(email);
                c.setGoogleSubject(sub);
                c.setGoogleEmail(email);
                c.setActive(true);
                c.setEmailVerified(emailVerified);
                // No password for Google-only accounts
                c.setPasswordHash(null);
            }

            customers.save(c);

            log.info("[CUSTOMER][GOOGLE_LOGIN] Google login success customerId={} email={} sub={}",
                    c.getId(), c.getEmail(), sub);

            return jwt.createCustomerToken("cust:" + c.getId(), Map.of("role", "CUSTOMER", "cid", c.getId()));

        } catch (IllegalArgumentException ex) {
            // let these propagate as is
            throw ex;
        } catch (Exception ex) {
            log.error("[CUSTOMER][GOOGLE_LOGIN] Error verifying Google token", ex);
            throw new IllegalArgumentException("Failed to verify Google account. Please try again.");
        }
    }

    /**
     * Verifies a customer's email using an OTP code sent by email.
     * Frontend should call this with (email, code) from the verify screen.
     */
    @Transactional
    public void verifyEmailOtp(String emailRaw, String otpCodeRaw) {
        String email = normalizeEmail(emailRaw);
        String code = safeTrim(otpCodeRaw);

        if (isBlank(email)) throw new IllegalArgumentException("Email is required");
        if (isBlank(code)) throw new IllegalArgumentException("OTP code is required");

        Customer customer = customers.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("No account found for this email"));

        AuthOtpToken token = otpRepo
                .findTopByDestinationAndChannelAndPurposeOrderByCreatedAtDesc(
                        email, CHANNEL_EMAIL, PURPOSE_VERIFY_EMAIL)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired code"));


        // Validate
        if (token.getConsumedAt() != null) {
            throw new IllegalArgumentException("Code already used");
        }
        if (token.getExpiresAt() == null || token.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new IllegalArgumentException("Code expired");
        }
        if (!code.equals(token.getCode())) {
            throw new IllegalArgumentException("Invalid code");
        }

        // Mark email as verified
        customer.setEmailVerified(true);
        token.setConsumedAt(OffsetDateTime.now());

        log.info("[CUSTOMER][VERIFY_EMAIL_OTP] Email verified for customerId={} email={}", customer.getId(), email);
    }

    /**
     * Verifies email OTP and returns a JWT token for auto-login.
     * Use this after registration for a seamless verify-and-login flow.
     */
    @Transactional
    public String verifyEmailOtpAndLogin(String emailRaw, String otpCodeRaw) {
        String email = normalizeEmail(emailRaw);
        String code = safeTrim(otpCodeRaw);

        if (isBlank(email)) throw new IllegalArgumentException("Email is required");
        if (isBlank(code)) throw new IllegalArgumentException("OTP code is required");

        Customer customer = customers.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("No account found for this email"));

        AuthOtpToken token = otpRepo
                .findTopByDestinationAndChannelAndPurposeOrderByCreatedAtDesc(
                        email, CHANNEL_EMAIL, PURPOSE_VERIFY_EMAIL)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired code"));

        // Validate
        if (token.getConsumedAt() != null) {
            throw new IllegalArgumentException("Code already used");
        }
        if (token.getExpiresAt() == null || token.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new IllegalArgumentException("Code expired");
        }
        if (!code.equals(token.getCode())) {
            throw new IllegalArgumentException("Invalid code");
        }

        // Mark email as verified
        customer.setEmailVerified(true);
        token.setConsumedAt(OffsetDateTime.now());

        log.info("[CUSTOMER][VERIFY_EMAIL_OTP_LOGIN] Email verified and logged in customerId={} email={}", customer.getId(), email);

        // Return JWT token for auto-login
        return jwt.createCustomerToken("cust:" + customer.getId(), Map.of("role", "CUSTOMER", "cid", customer.getId()));

    }

    /** Validates customer credentials (email/phone + password) and returns a CUSTOMER JWT. */
    public String login(CustomerLoginRequest req) {
        if (req == null) throw new IllegalArgumentException("CustomerLoginRequest is required");
        String identifier = safeTrim(req.getIdentifier());
        String rawPassword = safeTrim(req.getPassword());

        if (isBlank(identifier) || isBlank(rawPassword)) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        // Determine if identifier is email or phone
        boolean isEmail = identifier.contains("@");
        boolean isPhone = identifier.startsWith("+91") || identifier.matches("^\\d{10}$");

        Customer c = null;
        
        if (isEmail) {
            String email = normalizeEmail(identifier);
            c = customers.findByEmail(email).orElse(null);
        } else if (isPhone) {
            // Normalize phone: ensure +91 prefix
            String phone = identifier.startsWith("+91") ? identifier : "+91" + identifier;
            c = customers.findByPhone(phone).orElse(null);
        }

        if (c == null) {
            throw new IllegalArgumentException("Invalid email/phone or password");
        }

        if (!Boolean.TRUE.equals(c.getActive()) ||
                c.getPasswordHash() == null ||
                c.getPasswordHash().isBlank()) {
            throw new IllegalArgumentException("Invalid email/phone or password");
        }

        if (!encoder.matches(rawPassword, c.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email/phone or password");
        }

        log.info("[CUSTOMER][LOGIN] Login successful for customerId={} via {}", c.getId(), isEmail ? "email" : "phone");

        // For email-based accounts, require email verification
        if (isEmail && !Boolean.TRUE.equals(c.getEmailVerified())) {
            log.warn("[CUSTOMER][LOGIN] Blocked login for unverified customerId={}", c.getId());
            throw new IllegalArgumentException("Please verify your email using the OTP sent to you.");
        }

        return jwt.createCustomerToken("cust:" + c.getId(), Map.of("role", "CUSTOMER", "cid", c.getId()));

    }

    /**
     * Resends a verification OTP to the customer's email.
     * Can be called from "Resend code" on verify screen.
     */
    @Transactional
    public void resendVerificationEmail(String emailRaw) {
        String email = normalizeEmail(emailRaw);
        if (isBlank(email)) {
            throw new IllegalArgumentException("Email is required");
        }

        Customer c = customers.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("No account found for this email"));

        if (Boolean.TRUE.equals(c.getEmailVerified())) {
            log.info("[CUSTOMER][VERIFY_EMAIL_OTP] Resend requested but already verified, email={}", email);
            return;
        }

        // Issue a fresh OTP
        String otp = issueEmailOtp(c.getId(), email, PURPOSE_VERIFY_EMAIL);
        emailService.sendVerificationEmail(email, otp);

        log.info("[CUSTOMER][VERIFY_EMAIL_OTP] Verification OTP resent to {}", email);
    }

    /**
     * Starts an email OTP flow for "forgot password".
     * Frontend: user enters email → call this → show "enter code + new password" screen.
     */
    @Transactional
    public void startPasswordReset(String emailRaw) {
        String email = normalizeEmail(emailRaw);
        if (isBlank(email)) {
            throw new IllegalArgumentException("Email is required");
        }

        Customer c = customers.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("No account found for this email"));

        if (!Boolean.TRUE.equals(c.getActive())) {
            throw new IllegalArgumentException("Account is inactive");
        }

        String otp = issueEmailOtp(c.getId(), email, PURPOSE_FORGOT_PASSWORD);
        emailService.sendPasswordResetEmail(email, otp);

        log.info("[CUSTOMER][RESET_OTP] Password reset OTP sent to email={}", email);
    }

    /**
     * Completes password reset using email + OTP + new password.
     * Frontend should POST { email, code, newPassword } here.
     */
    @Transactional
    public void completePasswordReset(String emailRaw, String otpCodeRaw, String newPasswordRaw) {
        String email = normalizeEmail(emailRaw);
        String code = safeTrim(otpCodeRaw);
        String newPassword = safeTrim(newPasswordRaw);

        if (isBlank(email)) throw new IllegalArgumentException("Email is required");
        if (isBlank(code)) throw new IllegalArgumentException("OTP code is required");
        if (isBlank(newPassword)) throw new IllegalArgumentException("New password is required");

        Customer c = customers.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("No account found for this email"));

        AuthOtpToken token = otpRepo
                .findTopByDestinationAndChannelAndPurposeOrderByCreatedAtDesc(
                        email, CHANNEL_EMAIL, PURPOSE_FORGOT_PASSWORD)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired code"));

        if (token.getConsumedAt() != null) {
            throw new IllegalArgumentException("Code already used");
        }
        if (token.getExpiresAt() == null || token.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new IllegalArgumentException("Code expired");
        }
        if (!code.equals(token.getCode())) {
            throw new IllegalArgumentException("Invalid code");
        }

        // Update password
        c.setPasswordHash(encoder.encode(newPassword));
        token.setConsumedAt(OffsetDateTime.now());

        log.info("[CUSTOMER][RESET_OTP] Password reset successful for customerId={} email={}", c.getId(), email);
    }

    /* ===================== OTP helpers ===================== */

    /** Issues an OTP for a given customer+email+purpose and stores it in auth_otp_tokens. */
    @Transactional
    protected String issueEmailOtp(Long customerId, String email, OtpPurpose purpose) {
        String dest = normalizeEmail(email);
        if (isBlank(dest)) {
            throw new IllegalArgumentException("Destination email is required");
        }

        String code = generateNumericOtp(6);
        OffsetDateTime now = OffsetDateTime.now();

        AuthOtpToken otp = new AuthOtpToken();
        otp.setCustomer(customers.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found")));
        otp.setChannel(CHANNEL_EMAIL);         // enum
        otp.setDestination(dest);
        otp.setCode(code);
        otp.setPurpose(purpose);               // enum
        otp.setExpiresAt(now.plus(OTP_VALID_MINUTES, ChronoUnit.MINUTES));
        otp.setConsumedAt(null);

        otpRepo.save(otp);

        log.info("[AUTH_OTP][ISSUE] channel={} purpose={} dest={} customerId={} expiresAt={}",
                CHANNEL_EMAIL, purpose, dest, customerId, otp.getExpiresAt());

        return code;
    }

    /** Generate an n-digit numeric OTP (e.g., 6 digits). */
    private String generateNumericOtp(int digits) {
        if (digits <= 0) throw new IllegalArgumentException("digits must be > 0");
        int bound = (int) Math.pow(10, digits);
        int floor = (int) Math.pow(10, digits - 1);
        int n = RNG.nextInt(bound - floor) + floor;
        return Integer.toString(n);
    }

    /* ===================== String helpers ===================== */

    /** Returns true if the string is null or blank after trimming. */
    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    /** Trims a string, returning null when input is null. */
    private static String safeTrim(String s) {
        return s == null ? null : s.trim();
    }

    /** Normalizes email by trimming and lowercasing. */
    private static String normalizeEmail(String email) {
        String e = safeTrim(email);
        return e == null ? null : e.toLowerCase();
    }
}
