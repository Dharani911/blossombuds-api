package com.blossombuds.security;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.BucketCrossOriginConfiguration;
import com.amazonaws.services.s3.model.CORSRule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Sets CORS rules on the R2 bucket at startup so browsers can load
 * presigned-URL images directly from r2.cloudflarestorage.com.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CloudflareR2CorsInitializer implements ApplicationRunner {

    private final AmazonS3 r2;

    @Value("${cloudflare.r2.bucket}")
    private String bucket;

    @Value("${app.frontend.baseUrl}")
    private String frontendBaseUrl;

    // Optional comma-separated extra origins (e.g. bare domain, staging URL)
    @Value("${cloudflare.r2.cors.extra-origins:}")
    private String extraOrigins;

    @Override
    public void run(ApplicationArguments args) {
        try {
            List<String> origins = buildOriginList();
            log.info("[R2-CORS] Configuring CORS for bucket={} origins={}", bucket, origins);

            CORSRule rule = new CORSRule()
                    .withAllowedMethods(List.of(CORSRule.AllowedMethods.GET))
                    .withAllowedOrigins(origins)
                    .withAllowedHeaders(List.of("*"))
                    .withMaxAgeSeconds(3600);

            BucketCrossOriginConfiguration config = new BucketCrossOriginConfiguration()
                    .withRules(List.of(rule));

            r2.setBucketCrossOriginConfiguration(bucket, config);
            log.info("[R2-CORS] CORS rules applied successfully");
        } catch (Exception e) {
            log.warn("[R2-CORS] Could not set CORS rules on bucket={}: {}", bucket, e.getMessage());
        }
    }

    private List<String> buildOriginList() {
        List<String> list = new ArrayList<>();

        // Always include the configured frontend base URL
        if (frontendBaseUrl != null && !frontendBaseUrl.isBlank()) {
            list.add(frontendBaseUrl.stripTrailing().replaceAll("/+$", ""));
        }

        // Include any extra origins from config
        if (extraOrigins != null && !extraOrigins.isBlank()) {
            for (String o : extraOrigins.split(",")) {
                String trimmed = o.strip();
                if (!trimmed.isEmpty()) list.add(trimmed);
            }
        }

        return list;
    }
}
