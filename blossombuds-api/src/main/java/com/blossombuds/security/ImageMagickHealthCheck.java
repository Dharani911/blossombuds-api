package com.blossombuds.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;

@Component
public class ImageMagickHealthCheck {

    private static final Logger log = LoggerFactory.getLogger(ImageMagickHealthCheck.class);

    @Value("${imagemagick.command:convert}")
    private String magickCmd;

    @EventListener(ApplicationReadyEvent.class)
    public void checkImageMagickOnStartup() {
        log.info("╔════════════════════════════════════════════════════════════╗");
        log.info("║         ImageMagick Configuration Check                   ║");
        log.info("╚════════════════════════════════════════════════════════════╝");

        try {
            // Check version
            ProcessBuilder versionPb = new ProcessBuilder(magickCmd, "--version");
            Process versionProc = versionPb.start();

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(versionProc.getInputStream()))) {
                reader.lines().limit(2).forEach(line -> log.info("Version: {}", line));
            }
            versionProc.waitFor();

            // Check for HEIC support
            ProcessBuilder formatPb = new ProcessBuilder(magickCmd, "-list", "format");
            Process formatProc = formatPb.start();

            boolean heicSupported = false;
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(formatProc.getInputStream()))) {

                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.contains("HEIC") || line.contains("HEIF")) {
                        log.info("HEIC Support Found: {}", line.trim());
                        heicSupported = true;
                        break;
                    }
                }
            }
            formatProc.waitFor();

            if (!heicSupported) {
                log.error("HEIC support NOT FOUND! Image uploads may fail.");
            } else {
                log.info("ImageMagick HEIC support confirmed.");
            }

            log.info("════════════════════════════════════════════════════════════");
        } catch (Exception e) {
            log.error("ImageMagick health check FAILED: {}", e.getMessage(), e);
        }
    }

}
