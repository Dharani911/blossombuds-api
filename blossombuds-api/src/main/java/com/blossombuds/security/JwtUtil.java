package com.blossombuds.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

/** Small helper for issuing and validating JWTs (HS256). */
@Component
public class JwtUtil {
    private final SecretKey key;
    private final long ttlMillis;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            // choose one of these two @Values; keep both temporarily if migrating
            @Value("${app.jwt.ttl-seconds:7200}") long ttlSeconds
            // @Value("${app.jwt.ttl-min:120}") long ttlMin
    ) {
        byte[] keyBytes;

        // Support "base64:<value>" or raw secret
        if (secret.startsWith("base64:")) {
            keyBytes = Decoders.BASE64.decode(secret.substring("base64:".length()));
        } else {
            keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        }

        if (keyBytes.length < 32) {
            throw new IllegalArgumentException(
                    "app.jwt.secret must be at least 32 bytes (256 bits) for HS256. " +
                            "Generate one with `openssl rand -base64 32` and prefix with base64:"
            );
        }

        this.key = Keys.hmacShaKeyFor(keyBytes);

        // If using seconds:
        this.ttlMillis = ttlSeconds * 1000L;

        // If you prefer minutes, comment the line above and uncomment below:
        // this.ttlMillis = ttlMin * 60_000L;
    }

    /** Create a signed token for the given subject and claims. */
    public String createToken(String subject, Map<String, Object> claims) {
        Instant now = Instant.now();
        return Jwts.builder()
                .setSubject(subject)
                .addClaims(claims)
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(now.plusMillis(ttlMillis)))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /** Validate a token and return the subject (username). */
    public String validateAndGetSubject(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }
}
