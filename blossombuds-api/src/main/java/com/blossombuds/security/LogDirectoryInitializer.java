package com.blossombuds.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.io.File;

@Component
public class LogDirectoryInitializer {

    @Value("${spring.profiles.active:local}")
    private String profile;

    @PostConstruct
    public void createLogDirectory() {
        String logPath = switch (profile) {
            case "prod" -> "/tmp/logs";
            default -> "logs";
        };

        File dir = new File(logPath);
        if (!dir.exists()) {
            boolean created = dir.mkdirs();
            if (created) {
                System.out.println("✅ Created log directory: " + logPath);
            } else {
                System.err.println("❌ Failed to create log directory: " + logPath);
            }
        }
    }
}

