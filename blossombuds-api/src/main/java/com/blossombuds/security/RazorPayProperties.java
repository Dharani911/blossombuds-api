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
    private String keyId;
    private String keySecret;
    private String baseUrl = "https://api.razorpay.com/v1";

    // Webhook secrets (env-specific)
    private String webhookSecret;        // live
    private String webhookSecretTest;    // /webhook/test
    private String webhookSecretStage;   // /webhook/stage
}

