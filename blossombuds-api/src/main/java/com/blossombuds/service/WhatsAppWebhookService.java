package com.blossombuds.service;

import com.blossombuds.domain.WhatsAppCampaign;
import com.blossombuds.domain.WhatsAppCampaignRecipient;
import com.blossombuds.domain.WhatsAppMessageEvent;
import com.blossombuds.repository.WhatsAppCampaignRecipientRepository;
import com.blossombuds.repository.WhatsAppCampaignRepository;
import com.blossombuds.repository.WhatsAppMessageEventRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/** Service for processing Meta WhatsApp Cloud API webhook payloads. */
@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppWebhookService {

    private final ObjectMapper objectMapper;
    private final WhatsAppMessageEventRepository messageEventRepository;
    private final WhatsAppCampaignRecipientRepository recipientRepository;
    private final WhatsAppCampaignRepository campaignRepository;

    /** Stores and processes a raw WhatsApp webhook payload. */
    @Transactional
    public void processWebhookPayload(String rawPayload) {
        WhatsAppMessageEvent rawEvent = new WhatsAppMessageEvent();
        rawEvent.setEventType("RAW_WEBHOOK");
        rawEvent.setRawPayload(rawPayload);
        rawEvent.setReceivedAt(OffsetDateTime.now());
        rawEvent.setCreatedAt(OffsetDateTime.now());
        messageEventRepository.save(rawEvent);

        if (rawPayload == null || rawPayload.isBlank()) {
            log.warn("[WHATSAPP][WEBHOOK] Empty payload received");
            return;
        }

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