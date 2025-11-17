package com.blossombuds.service;

import com.blossombuds.domain.Customer;
import com.blossombuds.domain.EmailVerificationToken;
import com.blossombuds.dto.CustomerAuthDtos.CustomerLoginRequest;
import com.blossombuds.dto.CustomerAuthDtos.RegisterRequest;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.repository.EmailVerificationTokenRepository;
import com.blossombuds.security.JwtUtil;
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
import java.util.Base64;
import java.util.Map;

/** Auth service for customers: register, email-verify, and login (issues CUSTOMER JWT). */
@Slf4j
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerAuthService {

    private final CustomerRepository customers;
    private final EmailVerificationTokenRepository evtRepo;
    private final PasswordEncoder encoder;
    private final EmailService emailService;
    private final JwtUtil jwt;

    @Value("${app.frontend.baseUrl}")
    private String frontendBase;

    private static final SecureRandom RNG = new SecureRandom();

    /** Registers a customer, sends verification email, and returns a CUSTOMER JWT. */
    @Transactional
    public String register(RegisterRequest req) {
        if (req == null) throw new IllegalArgumentException("RegisterRequest is required");
        String name = safeTrim(req.getName());
        String email = normalizeEmail(req.getEmail());
        String phone = safeTrim(req.getPhone());
        String rawPassword = safeTrim(req.getPassword());

        if (isBlank(name)) throw new IllegalArgumentException("Name is required");
        if (isBlank(email)) throw new IllegalArgumentException("Email is required");
        if (isBlank(rawPassword)) throw new IllegalArgumentException("Password is required");

        // Uniqueness: email must be unused
        customers.findByEmail(email).ifPresent(c -> {
            throw new IllegalArgumentException("Email already registered");
        });

        // Create customer
        Customer c = new Customer();
        c.setName(name);
        c.setEmail(email);
        c.setPhone(phone);
        c.setPasswordHash(encoder.encode(rawPassword));
        c.setActive(true);
        c.setEmailVerified(false);
        //c.setCreatedBy("system");
        //c.setCreatedAt(OffsetDateTime.now());
        customers.save(c);

        log.info("[CUSTOMER][REGISTER] New customer registered: email={}, id={}", email, c.getId());

        // Invalidate any previous active tokens for this customer (defense-in-depth)
        evtRepo.deactivateActiveTokensForCustomer(c.getId());

        // Create fresh email verification token (valid 24h)
        String token = randomToken();
        EmailVerificationToken evt = new EmailVerificationToken();
        evt.setCustomerId(c.getId());
        evt.setToken(token);
        evt.setExpiresAt(OffsetDateTime.now().plus(24, ChronoUnit.HOURS));
        evt.setActive(true);
        //evt.setCreatedBy("system");
        //evt.setCreatedAt(OffsetDateTime.now());
        evtRepo.save(evt);

        // Send email
        if (isBlank(frontendBase)) {
            throw new IllegalStateException("Frontend base URL is not configured");
        }
        String verifyUrl = frontendBase + "/verify-email?token=" + token;
        emailService.sendVerificationEmail(c.getEmail(), verifyUrl);
        log.info("[CUSTOMER][VERIFY_EMAIL] Verification email sent to: {}", email);

        // Return a CUSTOMER JWT so the UI can consider the user logged in (even before verify)
        return jwt.createToken("cust:" + c.getId(), Map.of("role", "CUSTOMER", "cid", c.getId()));
    }

    /** Marks the customer email as verified if token is valid and unconsumed. */
    @Transactional
    public void verifyEmail(String token) {
        String t = safeTrim(token);
        if (isBlank(t)) throw new IllegalArgumentException("Token is required");

        EmailVerificationToken evt = evtRepo.findByToken(t)
                .orElseThrow(() -> new IllegalArgumentException("Invalid token"));

        if (!Boolean.TRUE.equals(evt.getActive())
                || evt.getConsumedAt() != null
                || evt.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new IllegalArgumentException("Token expired or already used");
        }

        Customer customer = customers.findById(evt.getCustomerId())
                .orElseThrow(() -> new IllegalArgumentException("Customer not found"));

        customer.setEmailVerified(true);
        //customer.setModifiedBy("system");
        //customer.setModifiedAt(OffsetDateTime.now());

        evt.setConsumedAt(OffsetDateTime.now());
        evt.setActive(false);

        // Optional: deactivate any other active tokens for this customer
        evtRepo.deactivateActiveTokensForCustomer(customer.getId());
        log.info("[CUSTOMER][VERIFY] Email verified for customerId={}", customer.getId());

    }

    /** Validates customer credentials and returns a CUSTOMER JWT. */
    public String login(CustomerLoginRequest req) {
        if (req == null) throw new IllegalArgumentException("CustomerLoginRequest is required");
        String email = normalizeEmail(req.getEmail());
        String rawPassword = safeTrim(req.getPassword());

        if (isBlank(email) || isBlank(rawPassword)) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        Customer c = customers.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!Boolean.TRUE.equals(c.getActive()) || c.getPasswordHash() == null || c.getPasswordHash().isBlank()) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        if (!encoder.matches(rawPassword, c.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }
        log.info("[CUSTOMER][LOGIN] Login successful for customerId={}", c.getId());

        return jwt.createToken("cust:" + c.getId(), Map.of("role", "CUSTOMER", "cid", c.getId()));
    }

    /** Generates a URL-safe random token (240 bits). */
    private static String randomToken() {
        byte[] b = new byte[30];
        RNG.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

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
