package com.blossombuds.web;

import com.blossombuds.domain.Setting;
import com.blossombuds.domain.WhatsAppMessageEvent;
import com.blossombuds.repository.WhatsAppMessageEventRepository;
import com.blossombuds.service.SettingsService;
import com.blossombuds.service.WhatsAppWebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;

/** Public webhook APIs for Meta WhatsApp Cloud API verification and events. */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/webhooks/whatsapp")
public class WhatsAppWebhookController {

    private final SettingsService settingsService;
    private final WhatsAppMessageEventRepository messageEventRepository;
    private final WhatsAppWebhookService whatsAppWebhookService;

    /** Verifies WhatsApp webhook subscription from Meta. */
    @GetMapping
    public ResponseEntity<String> verifyWebhook(
            @RequestParam(name = "hub.mode", required = false) String mode,
            @RequestParam(name = "hub.verify_token", required = false) String verifyToken,
            @RequestParam(name = "hub.challenge", required = false) String challenge
    ) {
        String expectedToken = setting("whatsapp.cloud.verify_token", "");

        if ("subscribe".equals(mode) && expectedToken.equals(verifyToken)) {
            log.info("[WHATSAPP][WEBHOOK][VERIFY] Webhook verified successfully");
            return ResponseEntity.ok(challenge == null ? "" : challenge);
        }

        log.warn("[WHATSAPP][WEBHOOK][VERIFY] Webhook verification failed");
        return ResponseEntity.status(403).body("Verification failed");
    }

    /** Receives WhatsApp webhook events from Meta. */
    /** Receives WhatsApp webhook events from Meta. */
    @PostMapping
    public ResponseEntity<String> receiveWebhook(@RequestBody String rawPayload) {
        log.info("[WHATSAPP][WEBHOOK][EVENT] Received WhatsApp webhook payload");
        whatsAppWebhookService.processWebhookPayload(rawPayload);
        return ResponseEntity.ok("EVENT_RECEIVED");
    }

    /** Reads a setting value or returns default when missing. */
    private String setting(String key, String defaultValue) {
        try {
            Setting setting = settingsService.get(key);
            if (setting == null || setting.getValue() == null) {
                return defaultValue;
            }
            return setting.getValue();
        } catch (Exception e) {
            return defaultValue;
        }
    }
}