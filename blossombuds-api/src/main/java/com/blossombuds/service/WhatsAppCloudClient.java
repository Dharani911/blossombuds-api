package com.blossombuds.service;

import com.blossombuds.domain.Setting;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Client service for sending Meta WhatsApp Cloud API template messages. */
@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppCloudClient {

    private final SettingsService settingsService;

    private final RestTemplate restTemplate = new RestTemplate();

    /** Sends a WhatsApp template message using Meta Cloud API or dry-run mode. */
    public SendResult sendTemplateMessage(
            String phone,
            String templateName,
            String languageCode,
            List<String> variables
    ) {
        if (isBlank(phone)) {
            return SendResult.failed("Phone number is required");
        }

        if (isBlank(templateName)) {
            return SendResult.failed("Template name is required");
        }

        String normalizedPhone = normalizePhone(phone);
        String lang = isBlank(languageCode) ? "en" : languageCode;

        boolean enabled = boolSetting("whatsapp.cloud.enabled", false);

        if (!enabled) {
            String dryRunId = "DRY_RUN_" + OffsetDateTime.now()
                    .format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"));
            log.info("[WHATSAPP][DRY_RUN] Template '{}' prepared for phone={}, variablesCount={}, dryRunId={}",
                    templateName, maskPhone(normalizedPhone), variables == null ? 0 : variables.size(), dryRunId);
            return SendResult.success(dryRunId, true);
        }

        String apiVersion = setting("whatsapp.cloud.api_version", "v25.0");
        String phoneNumberId = setting("whatsapp.cloud.phone_number_id", "");
        String accessToken = setting("whatsapp.cloud.access_token", "");

        if (isBlank(phoneNumberId)) {
            log.warn("[WHATSAPP][SEND] Missing phone number id");
            return SendResult.failed("WhatsApp phone number id is not configured");
        }

        if (isBlank(accessToken)) {
            log.warn("[WHATSAPP][SEND] Missing access token");
            return SendResult.failed("WhatsApp access token is not configured");
        }

        String url = "https://graph.facebook.com/" + apiVersion + "/" + phoneNumberId + "/messages";

        Map<String, Object> body = buildTemplatePayload(normalizedPhone, templateName, lang, variables);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(accessToken);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            log.info("[WHATSAPP][SEND] Sending template '{}' to phone={}", templateName, maskPhone(normalizedPhone));

            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    Map.class
            );

            String providerMessageId = extractMessageId(response.getBody());

            if (isBlank(providerMessageId)) {
                log.warn("[WHATSAPP][SEND] Message sent but provider message id missing. status={}",
                        response.getStatusCode());
                return SendResult.success("UNKNOWN_PROVIDER_MESSAGE_ID", false);
            }

            log.info("[WHATSAPP][SEND] Template '{}' sent successfully. providerMessageId={}",
                    templateName, providerMessageId);

            return SendResult.success(providerMessageId, false);

        } catch (Exception e) {
            log.error("[WHATSAPP][SEND] Failed to send template '{}' to phone={}: {}",
                    templateName, maskPhone(normalizedPhone), e.getMessage(), e);
            return SendResult.failed(e.getMessage());
        }
    }

    /** Builds Meta Cloud API template message payload. */
    private Map<String, Object> buildTemplatePayload(
            String phone,
            String templateName,
            String languageCode,
            List<String> variables
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messaging_product", "whatsapp");
        payload.put("to", phone);
        payload.put("type", "template");

        Map<String, Object> template = new LinkedHashMap<>();
        template.put("name", templateName);

        Map<String, Object> language = new LinkedHashMap<>();
        language.put("code", languageCode);
        template.put("language", language);

        List<Map<String, Object>> components = new ArrayList<>();

        if (variables != null && !variables.isEmpty()) {
            Map<String, Object> bodyComponent = new LinkedHashMap<>();
            bodyComponent.put("type", "body");

            List<Map<String, Object>> parameters = new ArrayList<>();
            for (String variable : variables) {
                Map<String, Object> parameter = new LinkedHashMap<>();
                parameter.put("type", "text");
                parameter.put("text", variable == null ? "" : variable);
                parameters.add(parameter);
            }

            bodyComponent.put("parameters", parameters);
            components.add(bodyComponent);
        }

        if (!components.isEmpty()) {
            template.put("components", components);
        }

        payload.put("template", template);
        return payload;
    }

    /** Extracts Meta message id from API response body. */
    private String extractMessageId(Map responseBody) {
        if (responseBody == null) {
            return "";
        }

        Object messagesObj = responseBody.get("messages");
        if (!(messagesObj instanceof List<?> messages) || messages.isEmpty()) {
            return "";
        }

        Object firstObj = messages.get(0);
        if (!(firstObj instanceof Map<?, ?> firstMessage)) {
            return "";
        }

        Object id = firstMessage.get("id");
        return id == null ? "" : String.valueOf(id);
    }

    /** Reads a string setting value with fallback. */
    private String setting(String key, String defaultValue) {
        try {
            Setting setting = settingsService.get(key);
            if (setting == null || setting.getValue() == null || setting.getValue().isBlank()) {
                return defaultValue;
            }
            return setting.getValue();
        } catch (Exception e) {
            return defaultValue;
        }
    }

    /** Reads a boolean setting value with fallback. */
    private boolean boolSetting(String key, boolean defaultValue) {
        String value = setting(key, String.valueOf(defaultValue));
        return "true".equalsIgnoreCase(value);
    }

    /** Normalizes WhatsApp phone number by removing +, spaces, and separators. */
    private String normalizePhone(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9]", "");
    }

    /** Masks a phone number for safe logging. */
    private String maskPhone(String phone) {
        if (phone == null || phone.length() <= 4) {
            return "****";
        }
        return "****" + phone.substring(phone.length() - 4);
    }

    /** Checks whether a string is null or blank. */
    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /** Result returned after attempting a WhatsApp send. */
    @Getter
    public static class SendResult {

        private final boolean success;
        private final boolean dryRun;
        private final String providerMessageId;
        private final String errorMessage;

        /** Creates a WhatsApp send result. */
        private SendResult(boolean success, boolean dryRun, String providerMessageId, String errorMessage) {
            this.success = success;
            this.dryRun = dryRun;
            this.providerMessageId = providerMessageId;
            this.errorMessage = errorMessage;
        }

        /** Creates a successful send result. */
        public static SendResult success(String providerMessageId, boolean dryRun) {
            return new SendResult(true, dryRun, providerMessageId, null);
        }

        /** Creates a failed send result. */
        public static SendResult failed(String errorMessage) {
            return new SendResult(false, false, null, errorMessage);
        }
    }
}