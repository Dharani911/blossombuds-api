package com.blossombuds.security;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // CORS + CSRF
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)

                // stateless (JWT only)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // exception → JSON
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((req, res, e) -> {
                            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            res.setContentType("application/json");
                            res.getWriter().write("{\"error\":\"unauthorized\"}");
                        })
                        .accessDeniedHandler((req, res, e) -> {
                            res.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            res.setContentType("application/json");
                            res.getWriter().write("{\"error\":\"forbidden\"}");
                        })
                )

                // route rules (order matters: specific → general)
                .authorizeHttpRequests(auth -> auth
                        // ----- PUBLIC GETs -----
                        .requestMatchers(HttpMethod.GET, "/api/catalog/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/search/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/cms/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/reviews/product/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/reviews/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()

                        // Settings (public read — adjust if needed)
                        .requestMatchers(HttpMethod.GET, "/api/settings/**").permitAll()

                        // Geo lookups public
                        .requestMatchers(HttpMethod.GET, "/api/locations/**").permitAll()

                        // Shipping price calculation usable pre-login
                        .requestMatchers(HttpMethod.GET,  "/api/shipping/quote").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/shipping/preview").permitAll()

                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/actuator/**").permitAll()

                        // ----- AUTH (PUBLIC) -----
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/customers/auth/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/payments/razorpay/webhook").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/logout").authenticated()

                        // ----- ADMIN namespace -----
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")   // 🔒 protect all admin APIs

                        // Catalog mutations (admin)
                        .requestMatchers(HttpMethod.POST,   "/api/catalog/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT,    "/api/catalog/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/catalog/**").hasRole("ADMIN")

                        // ----- CUSTOMER / ADMIN mixed -----
                        .requestMatchers(HttpMethod.GET, "/api/orders/**").hasAnyRole("CUSTOMER","ADMIN")
                        .requestMatchers("/api/promotions/**").hasAnyRole("ADMIN","CUSTOMER")
                        .requestMatchers("/api/partners/**").hasAnyRole("ADMIN","CUSTOMER")
                      //  .requestMatchers("/api/shipping/**").hasAnyRole("ADMIN","CUSTOMER") // protects other shipping endpoints (not quote/preview)
                        .requestMatchers(HttpMethod.POST, "/api/reviews").hasAnyRole("CUSTOMER","ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/reviews/**").hasAnyRole("CUSTOMER","ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/payments/razorpay/orders/**").hasAnyRole("CUSTOMER","ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/payments/razorpay/verify").hasAnyRole("CUSTOMER","ADMIN")
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                                // inside authorizeHttpRequests(auth -> auth ... )
                                .requestMatchers(HttpMethod.GET, "/api/feature-images/public/**").permitAll()
// (optional, if your images are served via these paths)
                                .requestMatchers(HttpMethod.GET, "/api/files/**").permitAll()
                                .requestMatchers(HttpMethod.GET, "/files/**").permitAll()
                                .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()

                                .requestMatchers(HttpMethod.GET,
                                        "/BB_logo.png",
                                        "/BB_logo.svg",
                                        "/favicon.ico",
                                        "/static/**",
                                        "/images/**",
                                        "/css/**",
                                        "/js/**"
                                ).permitAll()

                                // anything else
                        .anyRequest().authenticated()
                )

                // JWT filter
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /** Permissive CORS for dev (adjust for prod). */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();

        // Keep localhost for desktop dev
        cfg.setAllowedOrigins(List.of(
                "http://localhost:3000",
                "http://localhost:5173",
                "http://localhost:5174",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173",
                "https://blossombuds-frontend.vercel.app",
                "https://blossombuds-floral-artistry.com"
        ));

        // NEW: allow Vite when served on your LAN IP / mDNS host
        cfg.setAllowedOriginPatterns(List.of(
                "http://192.168.*.*:5173",
                "http://10.*.*.*:5173",
                "http://172.16.*.*:5173",
                "http://172.17.*.*:5173",
                "http://172.18.*.*:5173",
                "http://172.19.*.*:5173",
                "http://172.20.*.*:5173",
                "http://172.21.*.*:5173",
                "http://172.22.*.*:5173",
                "http://172.23.*.*:5173",
                "http://172.24.*.*:5173",
                "http://172.25.*.*:5173",
                "http://172.26.*.*:5173",
                "http://172.27.*.*:5173",
                "http://172.28.*.*:5173",
                "http://172.29.*.*:5173",
                "http://172.30.*.*:5173",
                "http://172.31.*.*:5173",
                "http://*.local:5173",
                "http://*.lan:5173",
                "https://blossombuds-frontend.vercel.app",
                "https://blossom-buds-floral-artistry.com"
        ));

        cfg.setAllowedMethods(List.of("GET","POST","PUT","DELETE","PATCH","OPTIONS"));
        cfg.setAllowedHeaders(List.of("*")); // simpler for dev; or list explicit headers
        cfg.setExposedHeaders(List.of("Authorization"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }


    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
