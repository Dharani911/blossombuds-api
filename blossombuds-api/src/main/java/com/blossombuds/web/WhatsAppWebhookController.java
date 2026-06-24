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

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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

    /**
     * Receives WhatsApp webhook events from Meta.
     * Accepts raw bytes so the HMAC-SHA256 is computed against the exact bytes Meta signed,
     * avoiding any charset re-encoding that @RequestBody String would apply.
     */
    @PostMapping(consumes = {"application/json", "text/plain", "*/*"})
    public ResponseEntity<String> receiveWebhook(
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
            @RequestBody byte[] rawPayloadBytes) {

        String appSecret = setting("whatsapp.cloud.app_secret", "");
        if (appSecret.isBlank()) {
            // No secret configured — process without validation so delivery-status
            // webhooks are not silently dropped during first-time setup.
            log.warn("[WHATSAPP][WEBHOOK][SECURITY] app_secret not configured — processing without signature validation");
        } else if (!isValidSignature(rawPayloadBytes, signature, appSecret)) {
            log.warn("[WHATSAPP][WEBHOOK][SECURITY] Invalid or missing X-Hub-Signature-256 — request rejected");
            return ResponseEntity.status(403).body("Invalid signature");
        }

        String rawPayload = new String(rawPayloadBytes, StandardCharsets.UTF_8);
        log.info("[WHATSAPP][WEBHOOK][EVENT] Received WhatsApp webhook payload");
        whatsAppWebhookService.processWebhookPayload(rawPayload);
        return ResponseEntity.ok("EVENT_RECEIVED");
    }

    /** Verifies Meta's HMAC-SHA256 signature against the raw request bytes using constant-time comparison. */
    private boolean isValidSignature(byte[] rawPayloadBytes, String signature, String appSecret) {
        if (signature == null || !signature.startsWith("sha256=")) return false;
        String hexPart = signature.substring(7);
        // Odd-length hex is always malformed — reject cleanly rather than ArrayIndexOutOfBoundsException
        if (hexPart.length() % 2 != 0) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal(rawPayloadBytes);
            byte[] actual = hexToBytes(hexPart);
            return MessageDigest.isEqual(expected, actual);
        } catch (Exception e) {
            log.error("[WHATSAPP][WEBHOOK][SECURITY] Signature verification error: {}", e.getMessage());
            return false;
        }
    }

    private static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] out = new byte[len / 2];
        for (int i = 0; i < len; i += 2)
            out[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4) | Character.digit(hex.charAt(i + 1), 16));
        return out;
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