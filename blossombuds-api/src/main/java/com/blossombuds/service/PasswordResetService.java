package com.blossombuds.service;

import com.blossombuds.domain.Customer;
import com.blossombuds.domain.PasswordResetToken;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.repository.PasswordResetTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

/** Handles customer password reset: issue tokens via email and confirm new passwords. */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PasswordResetService {

    private final PasswordResetTokenRepository prtRepo;
    private final CustomerRepository customerRepo;
    private final EmailService emailService;
    private final PasswordEncoder encoder;

    @Value("${app.frontend.baseUrl}")
    private String frontendBase;

    private static final SecureRandom RNG = new SecureRandom();

    /** Issues a password reset token (idempotent on email existence) and emails the link. */
    @Transactional(readOnly = false)
    public void requestReset(String email) {
        log.info("[RESET][REQUEST] Password reset requested for email: {}", email);
        if (email == null || email.isBlank()) {log.debug("Email is null or blank; skipping reset");return;} // privacy: no info leak
        var customerOpt = customerRepo.findByEmail(email.trim());
        if (customerOpt.isEmpty()){ log.info("[RESET][SKIPPED] No customer found with email: {}", email);
        return;}

        Customer c = customerOpt.get();
        log.debug("Found customer: id={}, email={}", c.getId(), c.getEmail());

        // expire previous tokens
        prtRepo.deactivateAllByCustomerId(c.getId());
        log.debug("Deactivated previous reset tokens for customerId={}", c.getId());

        String token = randomToken();
        PasswordResetToken prt = new PasswordResetToken();
        prt.setCustomerId(c.getId());
        prt.setToken(token);
        prt.setActive(true);
        prt.setExpiresAt(OffsetDateTime.now().plusHours(1));
        prtRepo.save(prt);

        // construct reset URL
        String resetUrl = frontendBase + "/reset-password?token=" + java.net.URLEncoder.encode(token, java.nio.charset.StandardCharsets.UTF_8);
        log.info("[RESET][EMAIL] Sending password reset email to {}", c.getEmail());

        emailService.sendPasswordResetEmail(c.getEmail(), resetUrl);
    }

    /** Confirms a new password using a valid, unexpired token, then consumes the token. */
    @Transactional(readOnly = false)
    public void confirmReset(String token, String newPassword) {
        log.info("[RESET][CONFIRM] Confirming password reset using token: {}", token);

        if (token == null || token.isBlank()) {
            log.warn("[RESET][INVALID] Token is missing or blank");
            throw new IllegalArgumentException("Invalid token");
        }
        if (newPassword == null || newPassword.isBlank() || newPassword.length() < 8) {
            log.warn("[RESET][INVALID] Password too short or null");
            throw new IllegalArgumentException("Password too short");
        }

        var prt = prtRepo.findByToken(token)
                .orElseThrow(() -> {
                    log.warn("[RESET][INVALID] No token found in DB for: {}", token);
                    return new IllegalArgumentException("Invalid token");
                });
        if (!Boolean.TRUE.equals(prt.getActive()) ||
                prt.getConsumedAt() != null ||
                prt.getExpiresAt() == null ||
                prt.getExpiresAt().isBefore(OffsetDateTime.now())) {
            log.warn("[RESET][EXPIRED] Token is expired or already used: {}", token);

            throw new IllegalArgumentException("Token expired or invalid");
        }

        Customer c = customerRepo.findById(prt.getCustomerId())
                .orElseThrow(() -> {
                    log.error("[RESET][MISSING] Customer not found for token: {}", token);
                    return new IllegalArgumentException("Customer not found");
                });
        // set and persist new password
        c.setPasswordHash(encoder.encode(newPassword));
        customerRepo.save(c); // <— force persist (don’t rely on flush when class is readOnly)
        log.info("[RESET][SUCCESS] Password reset successful for customerId={}", c.getId());

        // consume token
        prt.setActive(false);
        prt.setConsumedAt(OffsetDateTime.now());
        prtRepo.save(prt);
        log.debug("[RESET][TOKEN_CONSUMED] Token {} consumed and deactivated", token);
    }

    /** Random URL-safe token generator. */
    private static String randomToken() {
        byte[] b = new byte[30]; // 240 bits
        RNG.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }
}
