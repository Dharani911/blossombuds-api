package com.blossombuds.service;

import com.blossombuds.domain.Admin;
import com.blossombuds.dto.AuthDto.LoginRequest;
import com.blossombuds.repository.AdminRepository;
import com.blossombuds.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

/** Validates admin credentials and issues a signed JWT for ROLE_ADMIN access. */
@Slf4j
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final AdminRepository adminRepo;
    private final PasswordEncoder encoder;
    private final JwtUtil jwt;

    /** Verifies username/password and returns a signed JWT on success. */
    public String login(LoginRequest req) {
        if (req == null) {
            log.warn("❌ Login attempt failed: null request received");
            throw new IllegalArgumentException("LoginRequest is required");
        }
        String username = safeTrim(req.getUsername());
        String rawPassword = safeTrim(req.getPassword());
        if (username == null || username.isEmpty() || rawPassword == null || rawPassword.isEmpty()) {
            log.warn("❌ Login attempt failed: blank username or password");
            throw new IllegalArgumentException("Invalid username or password");
        }
        log.info("🔐 Attempting login for user '{}'", username);

        Admin admin = adminRepo.findByName(username)
                .orElseThrow(() -> {
                    log.warn("❌ Login failed: user '{}' not found", username);
                    return new IllegalArgumentException("Invalid username or password");
                });
        // Account status checks
        //if (!Boolean.TRUE.equals(admin.getActive()) || !Boolean.TRUE.equals(admin.getEnabled())) {
           // throw new IllegalArgumentException("Invalid username or password");
        //}
        if (admin.getPasswordHash() == null || admin.getPasswordHash().isBlank()) {
            log.warn("❌ Login failed: password not set for user '{}'", username);
            throw new IllegalArgumentException("Invalid username or password");
        }

        // Password verification
        if (!encoder.matches(rawPassword, admin.getPasswordHash())) {
            log.warn("❌ Login failed: incorrect password for user '{}'", username);
            throw new IllegalArgumentException("Invalid username or password");
        }
        log.info("✅ Login successful for user '{}'", username);

        // Build minimal claims; JwtUtil controls iat/exp and signing
        Map<String, Object> claims = Map.of(
                "role", "ADMIN",
                "uid", admin.getId()
        );
        String token = jwt.createToken(admin.getName(), claims);
        log.debug("📦 JWT created for '{}': {}", username, token.substring(0, 20) + "...");

        return token;
    }

    /** Safely trims a string, returning null when input is null. */
    private static String safeTrim(String s) {
        return (s == null) ? null : s.trim();
    }
}
