package com.blossombuds.service;

import com.blossombuds.domain.CustomerWhatsAppPreference;
import com.blossombuds.domain.WhatsAppCampaign;
import com.blossombuds.domain.WhatsAppCampaignRecipient;
import com.blossombuds.domain.WhatsAppTemplate;
import com.blossombuds.repository.CustomerWhatsAppPreferenceRepository;
import com.blossombuds.repository.WhatsAppCampaignRecipientRepository;
import com.blossombuds.repository.WhatsAppCampaignRepository;
import com.blossombuds.repository.WhatsAppTemplateRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.blossombuds.dto.WhatsAppDtos;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/** Service for creating and sending WhatsApp campaigns. */
@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppCampaignService {

    private final WhatsAppTemplateRepository templateRepository;
    private final WhatsAppCampaignRepository campaignRepository;
    private final WhatsAppCampaignRecipientRepository recipientRepository;
    private final CustomerWhatsAppPreferenceRepository preferenceRepository;
    private final WhatsAppCloudClient whatsAppCloudClient;

    /** Lists all active WhatsApp templates. */
    @Transactional(readOnly = true)
    public List<WhatsAppTemplate> listActiveTemplates() {
        return templateRepository.findByActiveTrueOrderByCreatedAtDesc();
    }

    /** Lists all active WhatsApp campaigns. */
    @Transactional(readOnly = true)
    public List<WhatsAppCampaign> listCampaigns() {
        return campaignRepository.findByActiveTrueOrderByCreatedAtDesc();
    }

    /** Lists recipients for a campaign. */
    @Transactional(readOnly = true)
    public List<WhatsAppCampaignRecipient> listRecipients(Long campaignId) {
        if (campaignId == null) {
            throw new IllegalArgumentException("campaignId is required");
        }
        return recipientRepository.findByCampaignIdAndActiveTrueOrderByCreatedAtAsc(campaignId);
    }

    /** Creates a campaign and prepares recipients based on audience type. */
    @Transactional
    public WhatsAppCampaign createCampaign(CreateCampaignRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Campaign request is required");
        }

        if (isBlank(request.getTitle())) {
            throw new IllegalArgumentException("Campaign title is required");
        }

        if (request.getTemplateId() == null) {
            throw new IllegalArgumentException("Template id is required");
        }

        String audienceType = isBlank(request.getAudienceType()) ? "ALL_OPTED_IN" : request.getAudienceType();

        WhatsAppTemplate template = templateRepository.findByIdAndActiveTrue(request.getTemplateId())
                .orElseThrow(() -> new IllegalArgumentException("Active WhatsApp template not found: " + request.getTemplateId()));

        WhatsAppCampaign campaign = new WhatsAppCampaign();
        campaign.setTitle(request.getTitle().trim());
        campaign.setTemplateId(template.getId());
        campaign.setAudienceType(audienceType);
        campaign.setStatus("DRAFT");
        campaign.setNotes(request.getNotes());
        campaign.setCreatedBy("admin");
        campaign.setModifiedBy("admin");
        campaign.setCreatedAt(OffsetDateTime.now());
        campaign.setModifiedAt(OffsetDateTime.now());

        campaign = campaignRepository.save(campaign);

        List<WhatsAppCampaignRecipient> recipients = buildRecipients(campaign, request);
        recipientRepository.saveAll(recipients);

        campaign.setTotalRecipients(recipients.size());
        campaign.setModifiedAt(OffsetDateTime.now());
        campaign = campaignRepository.save(campaign);

        log.info("[WHATSAPP][CAMPAIGN][CREATE] Created campaignId={}, template={}, recipients={}",
                campaign.getId(), template.getProviderTemplateName(), recipients.size());

        return campaign;
    }

    /** Sends all pending recipients for a campaign. */
    @Transactional
    public WhatsAppCampaign sendCampaign(Long campaignId) {
        if (campaignId == null) {
            throw new IllegalArgumentException("campaignId is required");
        }

        WhatsAppCampaign campaign = campaignRepository.findByIdAndActiveTrue(campaignId)
                .orElseThrow(() -> new IllegalArgumentException("Campaign not found: " + campaignId));

        WhatsAppTemplate template = templateRepository.findByIdAndActiveTrue(campaign.getTemplateId())
                .orElseThrow(() -> new IllegalArgumentException("Template not found for campaign: " + campaignId));

        List<WhatsAppCampaignRecipient> recipients =
                recipientRepository.findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(campaignId, "PENDING");

        if (recipients.isEmpty()) {
            log.warn("[WHATSAPP][CAMPAIGN][SEND] No pending recipients for campaignId={}", campaignId);
            campaign.setStatus("COMPLETED");
            campaign.setCompletedAt(OffsetDateTime.now());
            campaign.setModifiedAt(OffsetDateTime.now());
            return campaignRepository.save(campaign);
        }

        campaign.setStatus("SENDING");
        campaign.setStartedAt(campaign.getStartedAt() == null ? OffsetDateTime.now() : campaign.getStartedAt());
        campaign.setModifiedAt(OffsetDateTime.now());
        campaign = campaignRepository.save(campaign);

        int sent = 0;
        int failed = 0;

        for (WhatsAppCampaignRecipient recipient : recipients) {
            recipient.setQueuedAt(OffsetDateTime.now());
            recipient.setStatus("QUEUED");

            List<String> variables = buildTemplateVariables(recipient, template);

            WhatsAppCloudClient.SendResult result = whatsAppCloudClient.sendTemplateMessage(
                    recipient.getPhone(),
                    template.getProviderTemplateName(),
                    template.getLanguageCode(),
                    variables
            );

            if (result.isSuccess()) {
                recipient.setStatus("SENT");
                recipient.setProviderMessageId(result.getProviderMessageId());
                recipient.setSentAt(OffsetDateTime.now());
                recipient.setErrorMessage(null);
                sent++;
            } else {
                recipient.setStatus("FAILED");
                recipient.setFailedAt(OffsetDateTime.now());
                recipient.setErrorMessage(result.getErrorMessage());
                failed++;
            }

            recipient.setModifiedBy("system");
            recipient.setModifiedAt(OffsetDateTime.now());
            recipientRepository.save(recipient);
        }

        campaign.setSentCount(campaign.getSentCount() + sent);
        campaign.setFailedCount(campaign.getFailedCount() + failed);
        campaign.setStatus("COMPLETED");
        campaign.setCompletedAt(OffsetDateTime.now());
        campaign.setModifiedAt(OffsetDateTime.now());

        WhatsAppCampaign saved = campaignRepository.save(campaign);

        log.info("[WHATSAPP][CAMPAIGN][SEND] Completed campaignId={}, sent={}, failed={}",
                campaignId, sent, failed);

        return saved;
    }

    /** Builds campaign recipients from audience type or manual recipient list. */
    private List<WhatsAppCampaignRecipient> buildRecipients(WhatsAppCampaign campaign, CreateCampaignRequest request) {
        List<WhatsAppCampaignRecipient> recipients = new ArrayList<>();

        String audienceType = campaign.getAudienceType();

        if ("MANUAL".equalsIgnoreCase(audienceType)) {
            if (request.getRecipients() == null || request.getRecipients().isEmpty()) {
                throw new IllegalArgumentException("Manual campaign requires at least one recipient");
            }

            for (ManualRecipient item : request.getRecipients()) {
                if (item == null || isBlank(item.getPhone())) {
                    continue;
                }

                WhatsAppCampaignRecipient recipient = new WhatsAppCampaignRecipient();
                recipient.setCampaignId(campaign.getId());
                recipient.setCustomerId(item.getCustomerId());
                recipient.setPhone(normalizePhone(item.getPhone()));
                recipient.setRecipientName(isBlank(item.getName()) ? "Customer" : item.getName().trim());
                recipient.setStatus("PENDING");
                recipient.setVariablesJson(toVariablesText(recipient.getRecipientName(), request));
                recipient.setCreatedBy("admin");
                recipient.setModifiedBy("admin");
                recipient.setCreatedAt(OffsetDateTime.now());
                recipient.setModifiedAt(OffsetDateTime.now());
                recipients.add(recipient);
            }

            return recipients;
        }

        if ("ALL_OPTED_IN".equalsIgnoreCase(audienceType)) {
            List<CustomerWhatsAppPreference> preferences = preferenceRepository.findByOptedInTrueAndActiveTrue();

            for (CustomerWhatsAppPreference preference : preferences) {
                WhatsAppCampaignRecipient recipient = new WhatsAppCampaignRecipient();
                recipient.setCampaignId(campaign.getId());
                recipient.setCustomerId(preference.getCustomerId());
                recipient.setPhone(normalizePhone(preference.getPhone()));
                recipient.setRecipientName("Customer");
                recipient.setStatus("PENDING");
                recipient.setVariablesJson(toVariablesText("Customer", request));
                recipient.setCreatedBy("admin");
                recipient.setModifiedBy("admin");
                recipient.setCreatedAt(OffsetDateTime.now());
                recipient.setModifiedAt(OffsetDateTime.now());
                recipients.add(recipient);
            }

            return recipients;
        }

        throw new IllegalArgumentException("Unsupported audience type: " + audienceType);
    }
    /** Extracts one variable value from the simple semicolon-separated variables text. */
    private String getVariableValue(String variablesText, String key) {
        if (isBlank(variablesText) || isBlank(key)) {
            return "";
        }

        String prefix = key + "=";
        String[] parts = variablesText.split(";");

        for (String part : parts) {
            if (part.startsWith(prefix)) {
                return part.substring(prefix.length());
            }
        }

        return "";
    }
    /** Builds template variables for the selected campaign recipient. */
    /** Builds template variables in the exact order expected by the selected Meta template. */
    private List<String> buildTemplateVariables(WhatsAppCampaignRecipient recipient, WhatsAppTemplate template) {
        String templateName = template.getProviderTemplateName();

        String name = getVariableValue(recipient.getVariablesJson(), "name");
        String link = getVariableValue(recipient.getVariablesJson(), "link");
        String orderCode = getVariableValue(recipient.getVariablesJson(), "orderCode");
        String trackingNumber = getVariableValue(recipient.getVariablesJson(), "trackingNumber");
        String trackingLink = getVariableValue(recipient.getVariablesJson(), "trackingLink");
        String paymentLink = getVariableValue(recipient.getVariablesJson(), "paymentLink");

        if (isBlank(name)) {
            name = isBlank(recipient.getRecipientName()) ? "Customer" : recipient.getRecipientName();
        }

        List<String> variables = new ArrayList<>();

        if ("new_arrivals_campaign".equalsIgnoreCase(templateName)) {
            variables.add(name);
            variables.add(isBlank(link) ? "https://www.blossom-buds-floral-artistry.com/categories" : link);
            return variables;
        }

        if ("order_dispatched".equalsIgnoreCase(templateName)) {
            variables.add(name);
            variables.add(isBlank(orderCode) ? "your order" : orderCode);
            variables.add(isBlank(trackingNumber) ? "Not available" : trackingNumber);
            variables.add(isBlank(trackingLink) ? "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx" : trackingLink);
            return variables;
        }

        if ("payment_pending_reminder".equalsIgnoreCase(templateName)) {
            variables.add(name);
            variables.add(isBlank(orderCode) ? "your order" : orderCode);
            variables.add(isBlank(paymentLink) ? "https://www.blossom-buds-floral-artistry.com" : paymentLink);
            return variables;
        }

        variables.add(name);
        if (!isBlank(link)) {
            variables.add(link);
        }

        return variables;
    }
    /** Stores basic variables as a simple text format for the first version. */
    /** Stores template variables as a simple semicolon-separated text for the first CRM version. */
    private String toVariablesText(String name, CreateCampaignRequest request) {
        return "name=" + safe(name)
                + ";link=" + safe(request.getLink())
                + ";orderCode=" + safe(request.getOrderCode())
                + ";trackingNumber=" + safe(request.getTrackingNumber())
                + ";trackingLink=" + safe(request.getTrackingLink())
                + ";paymentLink=" + safe(request.getPaymentLink());
    }

    /** Extracts link variable from the simple variables text. */
    private String extractSecondVariable(String variablesText) {
        if (isBlank(variablesText)) {
            return "";
        }

        String[] parts = variablesText.split(";");
        for (String part : parts) {
            if (part.startsWith("link=")) {
                return part.substring("link=".length());
            }
        }

        return "";
    }

    /** Normalizes a phone number for WhatsApp Cloud API. */
    private String normalizePhone(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9]", "");
    }

    /** Checks whether a string is null or blank. */
    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /** Returns a null-safe string. */
    private String safe(String value) {
        return value == null ? "" : value;
    }

    /** Request object for creating a WhatsApp campaign. */
    @Getter
    @Setter
    public static class CreateCampaignRequest {

        /** Admin-facing campaign title. */
        private String title;

        /** Selected WhatsApp template id. */
        private Long templateId;

        /** Audience type such as ALL_OPTED_IN or MANUAL. */
        private String audienceType;

        /** Common link variable used in marketing templates. */
        private String link;

        /** Order code variable used by order/payment templates. */
        private String orderCode;

        /** Tracking number variable used by dispatch templates. */
        private String trackingNumber;

        /** Tracking link variable used by dispatch templates. */
        private String trackingLink;

        /** Payment link variable used by payment reminder templates. */
        private String paymentLink;

        /** Internal campaign notes. */
        private String notes;

        /** Manual recipient list, used when audienceType is MANUAL. */
        private List<ManualRecipient> recipients;
    }

    /** Manual recipient request object for WhatsApp campaigns. */
    @Getter
    @Setter
    public static class ManualRecipient {

        /** Optional linked customer id. */
        private Long customerId;

        /** Recipient display name. */
        private String name;

        /** Recipient WhatsApp phone number. */
        private String phone;
    }
    /** Converts a WhatsApp template entity into API response DTO. */
    public WhatsAppDtos.TemplateResponse toTemplateResponse(WhatsAppTemplate template) {
        return new WhatsAppDtos.TemplateResponse(
                template.getId(),
                template.getName(),
                template.getProviderTemplateName(),
                template.getCategory(),
                template.getLanguageCode(),
                template.getBodyPreview(),
                template.getVariableCount(),
                template.getActive()
        );
    }

    /** Converts a WhatsApp campaign entity into API response DTO. */
    public WhatsAppDtos.CampaignResponse toCampaignResponse(WhatsAppCampaign campaign) {
        return new WhatsAppDtos.CampaignResponse(
                campaign.getId(),
                campaign.getTitle(),
                campaign.getTemplateId(),
                campaign.getAudienceType(),
                campaign.getStatus(),
                campaign.getTotalRecipients(),
                campaign.getSentCount(),
                campaign.getFailedCount(),
                campaign.getDeliveredCount(),
                campaign.getReadCount(),
                campaign.getNotes(),
                campaign.getCreatedAt(),
                campaign.getCompletedAt()
        );
    }

    /** Converts a WhatsApp campaign recipient entity into API response DTO. */
    public WhatsAppDtos.RecipientResponse toRecipientResponse(WhatsAppCampaignRecipient recipient) {
        return new WhatsAppDtos.RecipientResponse(
                recipient.getId(),
                recipient.getCampaignId(),
                recipient.getCustomerId(),
                recipient.getPhone(),
                recipient.getRecipientName(),
                recipient.getStatus(),
                recipient.getProviderMessageId(),
                recipient.getErrorMessage(),
                recipient.getSentAt(),
                recipient.getFailedAt()
        );
    }
}