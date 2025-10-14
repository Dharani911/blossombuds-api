// src/main/java/com/blossombuds/config/RazorpayProperties.java
package com.blossombuds.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Binds Razorpay credentials and URLs from application properties. */
@Getter @Setter
@Component
@ConfigurationProperties(prefix = "app.razorpay")
public class RazorPayProperties {
    /** Public key id (NOT secret). */
    private String keyId;
    /** API secret (server-side only). */
    private String keySecret;
    /** Webhook secret used to verify Razorpay webhooks. */
    private String webhookSecret;
    /** Base API URL (default Razorpay production). */
    private String baseUrl = "https://api.razorpay.com/v1";
}
