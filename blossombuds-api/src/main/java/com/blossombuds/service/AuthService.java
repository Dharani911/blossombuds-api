package com.blossombuds.service;

import com.blossombuds.domain.Admin;
import com.blossombuds.dto.AuthDto.LoginRequest;
import com.blossombuds.repository.AdminRepository;
import com.blossombuds.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

/** Validates admin credentials and issues a signed JWT for ROLE_ADMIN access. */
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
            throw new IllegalArgumentException("LoginRequest is required");
        }
        String username = safeTrim(req.getUsername());
        String rawPassword = safeTrim(req.getPassword());
        if (username == null || username.isEmpty() || rawPassword == null || rawPassword.isEmpty()) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        Admin admin = adminRepo.findByName(username)
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));

        // Account status checks
        //if (!Boolean.TRUE.equals(admin.getActive()) || !Boolean.TRUE.equals(admin.getEnabled())) {
           // throw new IllegalArgumentException("Invalid username or password");
        //}
        if (admin.getPasswordHash() == null || admin.getPasswordHash().isBlank()) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        // Password verification
        if (!encoder.matches(rawPassword, admin.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        // Build minimal claims; JwtUtil controls iat/exp and signing
        Map<String, Object> claims = Map.of(
                "role", "ADMIN",
                "uid", admin.getId()
        );
        return jwt.createToken(admin.getName(), claims);
    }

    /** Safely trims a string, returning null when input is null. */
    private static String safeTrim(String s) {
        return (s == null) ? null : s.trim();
    }
}
