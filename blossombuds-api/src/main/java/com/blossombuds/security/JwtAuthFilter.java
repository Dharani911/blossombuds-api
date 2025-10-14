package com.blossombuds.security;

import com.blossombuds.domain.Admin;
import com.blossombuds.repository.AdminRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/** Reads Bearer token, validates it, and sets ROLE_ADMIN or ROLE_CUSTOMER based on JWT subject format. */
@Configuration
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtUtil jwt;
    private final AdminRepository admins;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String header = req.getHeader(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                String subject = jwt.validateAndGetSubject(token);
                UsernamePasswordAuthenticationToken auth = null;

                if (subject != null && subject.startsWith("cust:")) {
                    // Customer tokens use subject "cust:{id}"
                    auth = new UsernamePasswordAuthenticationToken(
                            subject, null, List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER")));
                } else if (subject != null) {
                    // Otherwise, treat subject as admin username
                    Admin admin = admins.findByName(subject).orElse(null);
                    if (admin != null && Boolean.TRUE.equals(admin.getActive())) {
                        auth = new UsernamePasswordAuthenticationToken(
                                admin.getName(), null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
                    }
                }

                if (auth != null) {
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception ignored) {
                // invalid/expired → leave unauthenticated
            }
        }
        chain.doFilter(req, res);
    }
}
