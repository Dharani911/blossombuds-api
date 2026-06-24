package com.blossombuds.service;

import com.blossombuds.domain.Setting;
import com.blossombuds.domain.WhatsAppMessageEvent;
import com.blossombuds.repository.CustomerWhatsAppPreferenceRepository;
import com.blossombuds.repository.WhatsAppCampaignRecipientRepository;
import com.blossombuds.repository.WhatsAppCampaignRepository;
import com.blossombuds.repository.WhatsAppContactRepository;
import com.blossombuds.repository.WhatsAppMessageEventRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;

/** Service for processing Meta WhatsApp Cloud API webhook payloads. */
@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppWebhookService {

    private static final java.util.concurrent.ConcurrentHashMap<String, Long> AUTO_REPLY_LAST_SENT
            = new java.util.concurrent.ConcurrentHashMap<>();
    private static final long AUTO_REPLY_COOLDOWN_MS = 5 * 60 * 1000L;

    private final ObjectMapper objectMapper;
    private final WhatsAppMessageEventRepository messageEventRepository;
    private final WhatsAppCampaignRecipientRepository recipientRepository;
    private final WhatsAppCampaignRepository campaignRepository;
    private final WhatsAppCloudClient whatsAppCloudClient;
    private final SettingsService settingsService;
    private final CustomerWhatsAppPreferenceRepository preferenceRepository;
    private final WhatsAppContactRepository whatsAppContactRepository;

    /** Stores and processes a raw WhatsApp webhook payload. */
    @Transactional
    public void processWebhookPayload(String rawPayload) {
        if (rawPayload == null || rawPayload.isBlank()) {
            log.warn("[WHATSAPP][WEBHOOK] Empty payload received");
            return;
        }

        WhatsAppMessageEvent rawEvent = new WhatsAppMessageEvent();
        rawEvent.setEventType("RAW_WEBHOOK");
        rawEvent.setRawPayload(rawPayload);
        rawEvent.setReceivedAt(OffsetDateTime.now());
        rawEvent.setCreatedAt(OffsetDateTime.now());
        messageEventRepository.save(rawEvent);

        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            JsonNode entries = root.path("entry");

            if (!entries.isArray()) {
                log.debug("[WHATSAPP][WEBHOOK] No entry array found");
                return;
            }

            for (JsonNode entry : entries) {
                JsonNode changes = entry.path("changes");

                if (!changes.isArray()) {
                    continue;
                }

                for (JsonNode change : changes) {
                    JsonNode value = change.path("value");
                    processStatuses(value);
                    processIncomingMessages(value, rawPayload);
                }
            }
        } catch (Exception e) {
            log.error("[WHATSAPP][WEBHOOK] Failed to process payload: {}", e.getMessage(), e);
        }
    }

    /** Processes message status updates such as sent, delivered, read, or failed. */
    private void processStatuses(JsonNode value) {
        JsonNode statuses = value.path("statuses");

        if (!statuses.isArray()) {
            return;
        }

        for (JsonNode statusNode : statuses) {
            String providerMessageId = text(statusNode, "id");
            String providerStatus = text(statusNode, "status");
            String phone = text(statusNode, "recipient_id");

            String errorCode = "";
            String errorMessage = "";

            JsonNode errors = statusNode.path("errors");
            if (errors.isArray() && !errors.isEmpty()) {
                JsonNode firstError = errors.get(0);
                errorCode = text(firstError, "code");
                errorMessage = text(firstError, "message");
            }

            WhatsAppMessageEvent event = new WhatsAppMessageEvent();
            event.setProviderMessageId(providerMessageId);
            event.setPhone(phone);
            event.setEventType("STATUS");
            event.setProviderStatus(providerStatus);
            event.setErrorCode(errorCode);
            event.setErrorMessage(errorMessage);
            event.setRawPayload(statusNode.toString());
            event.setReceivedAt(OffsetDateTime.now());
            event.setCreatedAt(OffsetDateTime.now());
            messageEventRepository.save(event);

            updateRecipientStatus(providerMessageId, providerStatus, errorMessage);
        }
    }

    /** Stores incoming customer messages for future opt-out or reply handling. */
    private void processIncomingMessages(JsonNode value, String rawPayload) {
        JsonNode messages = value.path("messages");

        if (!messages.isArray()) {
            return;
        }

        for (JsonNode messageNode : messages) {
            String providerMessageId = text(messageNode, "id");
            String phone = text(messageNode, "from");
            String messageType = text(messageNode, "type");

            WhatsAppMessageEvent event = new WhatsAppMessageEvent();
            event.setProviderMessageId(providerMessageId);
            event.setPhone(phone);
            event.setEventType("INCOMING_MESSAGE");
            event.setProviderStatus(messageType);
            event.setRawPayload(messageNode.toString());
            event.setReceivedAt(OffsetDateTime.now());
            event.setCreatedAt(OffsetDateTime.now());
            messageEventRepository.save(event);

            log.info("[WHATSAPP][WEBHOOK][MESSAGE] Incoming message received from phone={}, type={}",
                    maskPhone(phone), messageType);

            String bodyText = messageNode.path("text").path("body").asText("").trim();
            if ("STOP".equalsIgnoreCase(bodyText)) {
                handleStop(phone);
            } else {
                sendAutoReply(phone);
            }
        }
    }

    /**
     * Schedules an auto-reply to fire AFTER the enclosing transaction commits,
     * so the HTTP call to Meta API does not hold the DB connection open.
     */
    private void sendAutoReply(String phone) {
        String mainNumber = mainWhatsAppNumber();
        if (mainNumber.isBlank()) {
            log.debug("[WHATSAPP][AUTO_REPLY] brand.whatsapp not configured, skipping");
            return;
        }
        String ownDigits = ownPhoneDigits();
        String incomingDigits = phone == null ? "" : phone.replaceAll("[^0-9]", "");
        if (!ownDigits.isBlank() && incomingDigits.endsWith(ownDigits)) {
            log.debug("[WHATSAPP][AUTO_REPLY] Skipping auto-reply to own number");
            return;
        }
        // Rate-limit: one auto-reply per phone per 5 minutes to prevent reply loops.
        // Evict stale entries first so the map stays bounded under spam traffic.
        long now = System.currentTimeMillis();
        long evictBefore = now - AUTO_REPLY_COOLDOWN_MS;
        AUTO_REPLY_LAST_SENT.entrySet().removeIf(e -> e.getValue() < evictBefore);

        Long lastSent = AUTO_REPLY_LAST_SENT.get(phone);
        if (lastSent != null && (now - lastSent) < AUTO_REPLY_COOLDOWN_MS) {
            log.debug("[WHATSAPP][AUTO_REPLY] Rate-limited for phone={}", maskPhone(phone));
            return;
        }
        AUTO_REPLY_LAST_SENT.put(phone, now);

        String waLink = "https://wa.me/" + mainNumber;
        String message = "Hi! This number is used only for sending order updates and offers. "
                + "For queries or support, please reach us directly here: " + waLink;

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            // Defer the HTTP call until after commit so the DB connection is released first.
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    sendAutoReplyHttp(phone, message);
                }
            });
        } else {
            // No active transaction (e.g. called from a test or scheduler) — send directly.
            sendAutoReplyHttp(phone, message);
        }
    }

    /** Deactivates the sender in both preference and contacts tables, then confirms via WhatsApp. */
    private void handleStop(String phone) {
        if (phone == null || phone.isBlank()) return;
        OffsetDateTime now = OffsetDateTime.now();

        preferenceRepository.findByPhoneAndActiveTrue(phone).ifPresent(pref -> {
            pref.setOptedIn(false);
            pref.setOptedOutAt(now);
            pref.setActive(false);
            pref.setModifiedBy("webhook-stop");
            pref.setModifiedAt(now);
            preferenceRepository.save(pref);
            log.info("[WHATSAPP][STOP] Deactivated preference for phone={}", maskPhone(phone));
        });

        whatsAppContactRepository.findByPhone(phone).ifPresent(contact -> {
            contact.setOptedIn(false);
            contact.setOptedOutAt(now);
            contact.setActive(false);
            contact.setModifiedBy("webhook-stop");
            contact.setModifiedAt(now);
            whatsAppContactRepository.save(contact);
            log.info("[WHATSAPP][STOP] Deactivated expo contact for phone={}", maskPhone(phone));
        });

        String confirmMessage = "You have been unsubscribed from Blossom Buds marketing messages. "
                + "You will no longer receive promotional updates from us.";

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    whatsAppCloudClient.sendTextMessage(phone, confirmMessage);
                }
            });
        } else {
            whatsAppCloudClient.sendTextMessage(phone, confirmMessage);
        }
    }

    private void sendAutoReplyHttp(String phone, String message) {
        WhatsAppCloudClient.SendResult result = whatsAppCloudClient.sendTextMessage(phone, message);
        if (result.isSuccess()) {
            log.info("[WHATSAPP][AUTO_REPLY] Sent to phone={}", maskPhone(phone));
        } else {
            log.warn("[WHATSAPP][AUTO_REPLY] Failed for phone={}: {}", maskPhone(phone), result.getErrorMessage());
        }
    }

    /** Reads brand.whatsapp from settings and strips it to digits only for wa.me link. */
    private String mainWhatsAppNumber() {
        try {
            Setting s = settingsService.get("brand.whatsapp");
            if (s == null || s.getValue() == null || s.getValue().isBlank()) return "";
            return s.getValue().replaceAll("[^0-9]", "");
        } catch (Exception e) {
            return "";
        }
    }

    /** Returns last 10 digits of the Cloud API sending number to guard against echo loops. */
    private String ownPhoneDigits() {
        try {
            Setting s = settingsService.get("whatsapp.cloud.own_phone_number");
            if (s != null && s.getValue() != null && !s.getValue().isBlank()) {
                String digits = s.getValue().replaceAll("[^0-9]", "");
                return digits.length() >= 10 ? digits.substring(digits.length() - 10) : digits;
            }
            return "";
        } catch (Exception e) {
            return "";
        }
    }

    /** Updates campaign recipient row based on provider status. */
    private void updateRecipientStatus(String providerMessageId, String providerStatus, String errorMessage) {
        if (providerMessageId == null || providerMessageId.isBlank()) {
            return;
        }

        recipientRepository.findByProviderMessageId(providerMessageId).ifPresent(recipient -> {
            OffsetDateTime now = OffsetDateTime.now();

            if ("sent".equalsIgnoreCase(providerStatus)) {
                recipient.setStatus("SENT");
                recipient.setSentAt(recipient.getSentAt() == null ? now : recipient.getSentAt());
            } else if ("delivered".equalsIgnoreCase(providerStatus)) {
                recipient.setStatus("DELIVERED");
                recipient.setDeliveredAt(now);
            } else if ("read".equalsIgnoreCase(providerStatus)) {
                recipient.setStatus("READ");
                recipient.setReadAt(now);
            } else if ("failed".equalsIgnoreCase(providerStatus)) {
                recipient.setStatus("FAILED");
                recipient.setFailedAt(now);
                recipient.setErrorMessage(errorMessage);
            }

            recipient.setModifiedBy("webhook");
            recipient.setModifiedAt(now);
            recipientRepository.save(recipient);

            refreshCampaignCounts(recipient.getCampaignId());

            log.info("[WHATSAPP][WEBHOOK][STATUS] Updated recipientId={}, providerStatus={}",
                    recipient.getId(), providerStatus);
        });
    }

    /** Recalculates campaign status counters from recipient rows. */
    private void refreshCampaignCounts(Long campaignId) {
        if (campaignId == null) {
            return;
        }

        campaignRepository.findByIdAndActiveTrue(campaignId).ifPresent(campaign -> {
            long total = recipientRepository.countByCampaignIdAndActiveTrue(campaignId);
            long sent = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "SENT");
            long failed = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "FAILED");
            long delivered = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "DELIVERED");
            long read = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "READ");

            campaign.setTotalRecipients((int) total);
            campaign.setSentCount((int) sent);
            campaign.setFailedCount((int) failed);
            campaign.setDeliveredCount((int) delivered);
            campaign.setReadCount((int) read);
            campaign.setModifiedBy("webhook");
            campaign.setModifiedAt(OffsetDateTime.now());

            campaignRepository.save(campaign);
        });
    }

    /** Reads a text field from a JSON node safely. */
    private String text(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        return value.isMissingNode() || value.isNull() ? "" : value.asText("");
    }

    /** Masks a phone number for safe logging. */
    private String maskPhone(String phone) {
        if (phone == null || phone.length() <= 4) {
            return "****";
        }
        return "****" + phone.substring(phone.length() - 4);
    }
}