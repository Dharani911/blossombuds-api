package com.blossombuds.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Map;
import java.util.Optional;

@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorAware")
public class JpaAuditingConfig {

    @Bean
    public AuditorAware<String> auditorAware() {
        return new SecurityAuditorAware();
    }

    static class SecurityAuditorAware implements AuditorAware<String> {
        @Override
        public Optional<String> getCurrentAuditor() {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
                return Optional.of("system");
            }

            String username = null;
            Object principal = auth.getPrincipal();

            // Common cases: UserDetails, simple String principal, JWT/OAuth2 maps
            if (principal instanceof UserDetails ud) {
                username = ud.getUsername();
            } else if (principal instanceof String s) {
                username = s;
            } else if (principal instanceof Map<?, ?> attrs) {
                // Try typical OAuth2/OIDC attribute keys without depending on OIDC classes
                Object email = attrs.get("email");
                Object preferred = attrs.get("preferred_username");
                Object name = attrs.get("name");
                username = toNonBlank(email, preferred, name, auth.getName());
            } else {
                username = auth.getName();
            }

            if (username == null || username.isBlank()) {
                username = "system";
            }
            return Optional.of(username);
        }

        private String toNonBlank(Object... vals) {
            for (Object v : vals) {
                if (v instanceof String s && !s.isBlank()) return s;
            }
            return null;
        }
    }
}
