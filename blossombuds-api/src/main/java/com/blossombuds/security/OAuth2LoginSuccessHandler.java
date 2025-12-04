package com.blossombuds.security;

import com.blossombuds.domain.Customer;
import com.blossombuds.repository.CustomerRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final CustomerRepository customerRepository;
    private final JwtUtil jwtUtil;

    @Value("${app.frontend.baseUrl}")
    private String frontendUrl;

    @Override
    @Transactional
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        
        // Extract details from Google profile
        String email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");
        String googleId = oAuth2User.getAttribute("sub"); // 'sub' is standard for OIDC

        log.info("OAuth2 login success: email={}, googleId={}", email, googleId);

        if (email == null) {
            log.error("OAuth2 login failed: Email not found in provider response");
            response.sendRedirect(frontendUrl + "/login?error=no_email");
            return;
        }

        Customer customer = null;

        // 1. Try to find by Google Subject
        Optional<Customer> byGoogle = customerRepository.findByGoogleSubject(googleId);
        if (byGoogle.isPresent()) {
            customer = byGoogle.get();
        } else {
            // 2. Try to find by Email
            Optional<Customer> byEmail = customerRepository.findByEmail(email);
            if (byEmail.isPresent()) {
                customer = byEmail.get();
                // Link Google account
                if (customer.getGoogleSubject() == null) {
                    customer.setGoogleSubject(googleId);
                    customer.setGoogleEmail(email);
                    // If we trust Google, we can mark email as verified
                    customer.setEmailVerified(true);
                    customerRepository.save(customer);
                    log.info("Linked existing customer={} to Google account", customer.getId());
                } else if (!googleId.equals(customer.getGoogleSubject())) {
                    // Email exists but linked to DIFFERENT Google account? 
                    // This is a conflict or just a different login method for same user.
                    // For now, we assume it's fine to log them in, but maybe warn?
                    log.warn("Customer={} logged in with Google (sub={}) but has different existing google_subject={}", 
                            customer.getId(), googleId, customer.getGoogleSubject());
                }
            } else {
                // 3. Create new customer
                customer = new Customer();
                customer.setEmail(email);
                customer.setName(name != null ? name : "Guest");
                customer.setGoogleSubject(googleId);
                customer.setGoogleEmail(email);
                customer.setActive(true);
                customer.setEmailVerified(true); // Verified by Google
                customerRepository.save(customer);
                log.info("Created new customer via Google login: {}", email);
            }
        }

        // Generate JWT
        String token = jwtUtil.createCustomerToken("cust:" + customer.getId(), Map.of("role", "CUSTOMER", "cid", customer.getId()));

        // Redirect to frontend with token
        // We use a query param. In production, consider a short-lived cookie or other mechanism if URL leakage is a concern,
        // but for this setup, query param is standard for simple OAuth2-to-JWT handoffs.
        String targetUrl = frontendUrl + "/oauth2/redirect?token=" + token;
        response.sendRedirect(targetUrl);
    }
}
