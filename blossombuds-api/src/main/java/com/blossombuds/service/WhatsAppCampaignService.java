package com.blossombuds.service;

import com.blossombuds.domain.CustomerWhatsAppPreference;
import com.blossombuds.domain.WhatsAppCampaign;
import com.blossombuds.domain.WhatsAppCampaignRecipient;
import com.blossombuds.domain.WhatsAppContact;
import com.blossombuds.domain.WhatsAppTemplate;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.repository.CustomerWhatsAppPreferenceRepository;
import com.blossombuds.repository.WhatsAppCampaignRecipientRepository;
import com.blossombuds.repository.WhatsAppCampaignRepository;
import com.blossombuds.repository.WhatsAppContactRepository;
import com.blossombuds.repository.WhatsAppTemplateRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.blossombuds.dto.WhatsAppDtos;
import jakarta.annotation.PostConstruct;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Service for creating and sending WhatsApp campaigns. */
@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppCampaignService {

    private final WhatsAppTemplateRepository templateRepository;
    private final WhatsAppCampaignRepository campaignRepository;
    private final WhatsAppCampaignRecipientRepository recipientRepository;
    private final CustomerWhatsAppPreferenceRepository preferenceRepository;
    private final WhatsAppContactRepository whatsAppContactRepository;
    private final CustomerRepository customerRepository;
    private final WhatsAppCloudClient whatsAppCloudClient;

    /**
     * On startup, reset any campaigns that were left in SENDING (from a previous crash/restart).
     * Recipients in SENDING are reset to PENDING so they can be retried on the next send call.
     */
    @PostConstruct
    @Transactional
    public void recoverStuckCampaigns() {
        campaignRepository.findByActiveTrueOrderByCreatedAtDesc().stream()
                .filter(c -> "SENDING".equals(c.getStatus()))
                .forEach(campaign -> {
                    recipientRepository
                            .findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(campaign.getId(), "SENDING")
                            .forEach(r -> {
                                r.setStatus("PENDING");
                                r.setModifiedBy("system");
                                r.setModifiedAt(OffsetDateTime.now());
                                recipientRepository.save(r);
                            });
                    campaign.setStatus("FAILED");
                    campaign.setCompletedAt(OffsetDateTime.now());
                    campaign.setModifiedBy("system");
                    campaign.setModifiedAt(OffsetDateTime.now());
                    campaignRepository.save(campaign);
                    log.warn("[WHATSAPP][CAMPAIGN][RECOVERY] Reset stuck campaign campaignId={} from SENDING to FAILED",
                            campaign.getId());
                });
    }

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

        validateAudienceTemplateCompatibility(template.getProviderTemplateName(), audienceType);

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

    /**
     * Sends all pending recipients for a campaign.
     * Not @Transactional at the outer level — each DB write commits independently
     * so no single connection is held open across N blocking HTTP calls to Meta.
     */
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
            // Persist SENDING before the HTTP call so a mid-loop crash leaves the row
            // in a recoverable state (startup recovery resets SENDING → PENDING for retry)
            // rather than as PENDING which would be silently re-sent as a duplicate.
            recipient.setQueuedAt(OffsetDateTime.now());
            recipient.setStatus("SENDING");
            recipient.setModifiedBy("system");
            recipient.setModifiedAt(OffsetDateTime.now());
            recipientRepository.save(recipient);

            List<String> variables = buildTemplateVariables(recipient, template);
            String imageUrl = getVariableValue(recipient.getVariablesJson(), "imageUrl");

            // HTTP call outside any transaction — each recipient save commits on its own
            WhatsAppCloudClient.SendResult result = whatsAppCloudClient.sendTemplateMessage(
                    recipient.getPhone(),
                    template.getProviderTemplateName(),
                    template.getLanguageCode(),
                    variables,
                    isBlank(imageUrl) ? null : imageUrl
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

        campaign.setSentCount((campaign.getSentCount() == null ? 0 : campaign.getSentCount()) + sent);
        campaign.setFailedCount((campaign.getFailedCount() == null ? 0 : campaign.getFailedCount()) + failed);

        // Reflect true outcome: FAILED if all failed, PARTIAL if some failed, COMPLETED if all sent
        if (sent == 0) {
            campaign.setStatus("FAILED");
        } else if (failed > 0) {
            campaign.setStatus("PARTIAL");
        } else {
            campaign.setStatus("COMPLETED");
        }

        campaign.setCompletedAt(OffsetDateTime.now());
        campaign.setModifiedAt(OffsetDateTime.now());

        WhatsAppCampaign saved = campaignRepository.save(campaign);

        log.info("[WHATSAPP][CAMPAIGN][SEND] Finished campaignId={}, sent={}, failed={}, status={}",
                campaignId, sent, failed, saved.getStatus());

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

        if ("EXPO_CONTACTS".equalsIgnoreCase(audienceType)) {
            // Compare by last 10 digits so "+919876543210" matches "9876543210" in customer DB
            Set<String> registeredLast10 = customerRepository.findAllRegisteredPhones()
                    .stream()
                    .map(this::last10)
                    .collect(Collectors.toSet());

            List<WhatsAppContact> contacts = whatsAppContactRepository.findByOptedInTrueAndActiveTrue();
            int skipped = 0;

            for (WhatsAppContact contact : contacts) {
                String normalized = normalizePhone(contact.getPhone());
                if (registeredLast10.contains(last10(contact.getPhone()))) {
                    skipped++;
                    continue; // already a registered customer — managed via their preference
                }
                String contactName = isBlank(contact.getName()) ? "Customer" : contact.getName().trim();
                WhatsAppCampaignRecipient recipient = new WhatsAppCampaignRecipient();
                recipient.setCampaignId(campaign.getId());
                recipient.setPhone(normalized);
                recipient.setRecipientName(contactName);
                recipient.setStatus("PENDING");
                recipient.setVariablesJson(toVariablesText(contactName, request));
                recipient.setCreatedBy("admin");
                recipient.setModifiedBy("admin");
                recipient.setCreatedAt(OffsetDateTime.now());
                recipient.setModifiedAt(OffsetDateTime.now());
                recipients.add(recipient);
            }

            log.info("[WHATSAPP][CAMPAIGN][EXPO] contacts={} skipped(registered)={} queued={}",
                    contacts.size(), skipped, recipients.size());
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
        String offerText = getVariableValue(recipient.getVariablesJson(), "offerText");

        if (isBlank(name)) {
            name = isBlank(recipient.getRecipientName()) ? "Customer" : recipient.getRecipientName();
        }

        List<String> variables = new ArrayList<>();

        if ("new_arrivals_campaign".equalsIgnoreCase(templateName)) {
            variables.add(name);
            variables.add(isBlank(link) ? "https://www.blossom-buds-floral-artistry.com/categories" : link);
            return variables;
        }

        if ("festival_offers".equalsIgnoreCase(templateName)) {
            variables.add(name);
            variables.add(isBlank(offerText) ? "exclusive discounts" : offerText);
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

        if ("expo_outreach".equalsIgnoreCase(templateName)) {
            variables.add(name);
            variables.add(isBlank(offerText) ? "Check out our latest floral collections!" : offerText);
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
                + ";paymentLink=" + safe(request.getPaymentLink())
                + ";offerText=" + safe(request.getOfferText())
                + ";imageUrl=" + safe(request.getImageUrl());
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

    /** Normalizes a phone number for WhatsApp Cloud API (strips all non-digits). */
    private String normalizePhone(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9]", "");
    }

    /**
     * Returns the last 10 digits of a phone number for format-agnostic comparison.
     * "9876543210", "+919876543210", "919876543210" all return "9876543210".
     */
    private String last10(String phone) {
        if (phone == null) return "";
        String d = phone.replaceAll("[^0-9]", "");
        return d.length() >= 10 ? d.substring(d.length() - 10) : d;
    }

    /**
     * Enforces template-audience pairing rules:
     * - expo_outreach must only be sent to EXPO_CONTACTS (not registered customers)
     * - all other marketing templates must only be sent to ALL_OPTED_IN (not expo contacts)
     * MANUAL is always allowed for test sends.
     */
    private void validateAudienceTemplateCompatibility(String providerTemplateName, String audienceType) {
        if ("MANUAL".equalsIgnoreCase(audienceType)) return;

        boolean isExpoTemplate = "expo_outreach".equalsIgnoreCase(providerTemplateName);

        if (isExpoTemplate && !"EXPO_CONTACTS".equalsIgnoreCase(audienceType)) {
            throw new IllegalArgumentException(
                "The \"expo_outreach\" template can only be sent to Expo Contacts, not to registered customers.");
        }

        if (!isExpoTemplate && "EXPO_CONTACTS".equalsIgnoreCase(audienceType)) {
            throw new IllegalArgumentException(
                "The \"" + providerTemplateName + "\" template can only be sent to opted-in registered customers, not to Expo Contacts.");
        }
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

        /** Offer or discount text used by festival/promotional templates (e.g. "20% off"). */
        private String offerText;

        /** Public image URL attached as a header image (for templates with image header). */
        private String imageUrl;

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
    /**
     * Imports a batch of external contacts (expo leads). Skips phones that already exist
     * in whatsapp_contacts or belong to registered customers.
     * Returns a summary: {imported, skippedRegistered, skippedDuplicate}.
     */
    @Transactional
    public ImportResult importContacts(String source, List<ContactEntry> entries) {
        if (entries == null || entries.isEmpty()) {
            return new ImportResult(0, 0, 0);
        }

        // Compare by last 10 digits so "+919876543210" matches "9876543210" in customer DB
        Set<String> registeredLast10 = customerRepository.findAllRegisteredPhones()
                .stream()
                .map(this::last10)
                .collect(Collectors.toSet());

        int imported = 0, skippedRegistered = 0, skippedDuplicate = 0;

        for (ContactEntry entry : entries) {
            if (entry == null || isBlank(entry.getPhone())) continue;

            String normalized = normalizeE164(entry.getPhone());
            if (isBlank(normalized)) continue;

            if (registeredLast10.contains(last10(normalized))) {
                skippedRegistered++;
                continue;
            }

            if (whatsAppContactRepository.existsByPhone(normalized)) {
                skippedDuplicate++;
                continue;
            }

            WhatsAppContact contact = new WhatsAppContact();
            contact.setPhone(normalized);
            contact.setName(isBlank(entry.getName()) ? null : entry.getName().trim());
            contact.setSource(isBlank(source) ? "IMPORT" : source.trim().toUpperCase());
            contact.setOptedIn(Boolean.TRUE);
            contact.setActive(Boolean.TRUE);
            contact.setCreatedBy("admin");
            contact.setModifiedBy("admin");
            whatsAppContactRepository.save(contact);
            imported++;
        }

        log.info("[WHATSAPP][CONTACTS][IMPORT] source={} imported={} skippedRegistered={} skippedDuplicate={}",
                source, imported, skippedRegistered, skippedDuplicate);

        return new ImportResult(imported, skippedRegistered, skippedDuplicate);
    }

    /** Normalizes a raw phone string to E.164 (+91XXXXXXXXXX for Indian numbers). */
    private String normalizeE164(String raw) {
        if (raw == null) return "";
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.length() == 10) return "+91" + digits;
        if (digits.length() == 12 && digits.startsWith("91")) return "+" + digits;
        if (digits.length() == 13 && digits.startsWith("091")) return "+" + digits.substring(1);
        return digits.isEmpty() ? "" : "+" + digits;
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() <= 4) return "****";
        return "****" + phone.substring(phone.length() - 4);
    }

    @Getter @Setter
    public static class ContactEntry {
        private String phone;
        private String name;
    }

    @Getter
    public static class ImportResult {
        private final int imported;
        private final int skippedRegistered;
        private final int skippedDuplicate;

        public ImportResult(int imported, int skippedRegistered, int skippedDuplicate) {
            this.imported = imported;
            this.skippedRegistered = skippedRegistered;
            this.skippedDuplicate = skippedDuplicate;
        }
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