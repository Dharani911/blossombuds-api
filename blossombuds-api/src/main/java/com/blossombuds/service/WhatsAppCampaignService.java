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
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.blossombuds.dto.WhatsAppDtos;
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
    private final EmailCampaignService emailCampaignService;

    /**
     * On startup, reset any campaigns that were left in SENDING (from a previous crash/restart).
     * Recipients in SENDING are reset to PENDING so they can be retried on the next send call.
     *
     * Runs on ApplicationReadyEvent rather than @PostConstruct: @Transactional is applied by a
     * proxy that does not exist yet during bean initialisation, so the annotation was silently
     * inert there and each save committed on its own. Firing after startup means the transaction
     * is real and a partial recovery cannot leave rows half-reset.
     */
    @EventListener(ApplicationReadyEvent.class)
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

    /**
     * Removes a campaign from the admin list.
     *
     * Soft delete, matching the rest of the schema: the row and its recipients stay for audit, and
     * every query already filters on active. A campaign that has sent messages is a record of what
     * real customers received — destroying that to tidy a list would be the wrong trade.
     */
    @Transactional
    public void deleteCampaign(Long campaignId) {
        if (campaignId == null) {
            throw new IllegalArgumentException("campaignId is required");
        }
        WhatsAppCampaign campaign = campaignRepository.findByIdAndActiveTrue(campaignId)
                .orElseThrow(() -> new IllegalArgumentException("Campaign not found: " + campaignId));

        // Only unsent campaigns may be deleted. Once messages have gone out the campaign is the
        // record of what real people received — and the delivery-status webhooks still resolve
        // against its recipient rows. Enforced here as well as in the UI so the rule holds for any
        // caller, not just the button.
        if (!"DRAFT".equalsIgnoreCase(campaign.getStatus())) {
            throw new IllegalStateException(
                    "Only campaigns that have not been sent can be deleted. This one is "
                            + campaign.getStatus().toLowerCase() + ".");
        }

        recipientRepository.findByCampaignIdAndActiveTrueOrderByCreatedAtAsc(campaignId)
                .forEach(recipient -> {
                    recipient.setActive(Boolean.FALSE);
                    recipient.setModifiedBy("admin");
                    recipient.setModifiedAt(OffsetDateTime.now());
                    recipientRepository.save(recipient);
                });

        campaign.setActive(Boolean.FALSE);
        campaign.setModifiedBy("admin");
        campaign.setModifiedAt(OffsetDateTime.now());
        campaignRepository.save(campaign);

        log.info("[WHATSAPP][CAMPAIGN][DELETE] Soft-deleted campaignId={} status={}",
                campaignId, campaign.getStatus());
    }

    /**
     * Renders the message exactly as a recipient would receive it: the approved template body with
     * {{1}}, {{2}} … replaced by the values this campaign actually sends.
     *
     * The stored bodyPreview carries the placeholders, and buildTemplateVariables already knows the
     * per-template ordering, so the two combine into a faithful preview without duplicating any
     * of that ordering logic here.
     */
    @Transactional(readOnly = true)
    public String renderPreview(Long campaignId) {
        if (campaignId == null) {
            throw new IllegalArgumentException("campaignId is required");
        }
        WhatsAppCampaign campaign = campaignRepository.findByIdAndActiveTrue(campaignId)
                .orElseThrow(() -> new IllegalArgumentException("Campaign not found: " + campaignId));
        WhatsAppTemplate template = templateRepository.findByIdAndActiveTrue(campaign.getTemplateId())
                .orElseThrow(() -> new IllegalArgumentException("Template not found for campaign: " + campaignId));

        String body = template.getBodyPreview() == null ? "" : template.getBodyPreview();

        List<WhatsAppCampaignRecipient> recipients =
                recipientRepository.findByCampaignIdAndActiveTrueOrderByCreatedAtAsc(campaignId);
        if (recipients.isEmpty()) {
            return body;
        }

        List<String> variables = buildTemplateVariables(recipients.get(0), template);
        for (int i = 0; i < variables.size(); i++) {
            body = body.replace("{{" + (i + 1) + "}}", variables.get(i));
        }
        return body;
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

        boolean alsoEmailPhoneless = Boolean.TRUE.equals(request.getAlsoEmailPhoneless());
        if (alsoEmailPhoneless && !"ALL_OPTED_IN".equalsIgnoreCase(audienceType)) {
            throw new IllegalArgumentException(
                    "\"Also email customers with no phone number\" is only available for the All Opted-In audience.");
        }

        WhatsAppCampaign campaign = new WhatsAppCampaign();
        campaign.setTitle(request.getTitle().trim());
        campaign.setTemplateId(template.getId());
        campaign.setAudienceType(audienceType);
        campaign.setStatus("DRAFT");
        campaign.setNotes(request.getNotes());
        campaign.setAlsoEmailPhoneless(alsoEmailPhoneless);
        campaign.setCreatedBy("admin");
        campaign.setModifiedBy("admin");
        campaign.setCreatedAt(OffsetDateTime.now());
        campaign.setModifiedAt(OffsetDateTime.now());

        campaign = campaignRepository.save(campaign);

        List<WhatsAppCampaignRecipient> recipients = buildRecipients(campaign, request);

        // Refuse to create an empty campaign. Previously this saved happily with totalRecipients=0,
        // then Send reported "COMPLETED" without dispatching anything — two success messages and
        // zero delivered messages, with nothing in the UI explaining why.
        if (recipients.isEmpty()) {
            throw new IllegalArgumentException(
                    emptyAudienceMessage(audienceType, Boolean.TRUE.equals(request.getWarmOnly())));
        }

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

        // Refuse to re-enter a send that is already running. The admin UI disables the button, but
        // it cannot stop a second browser tab or a click after the 120s client timeout fires while
        // the server is still working. Without this, two overlapping runs each see
        // linkedEmailCampaignId == null (it is only written at the end) and both send a full email
        // blast, and each can pick up recipients the other has not marked SENDING yet.
        if ("SENDING".equalsIgnoreCase(campaign.getStatus())) {
            throw new IllegalStateException(
                    "This campaign is already sending. Wait for it to finish before sending again.");
        }

        WhatsAppTemplate template = templateRepository.findByIdAndActiveTrue(campaign.getTemplateId())
                .orElseThrow(() -> new IllegalArgumentException("Template not found for campaign: " + campaignId));

        List<WhatsAppCampaignRecipient> recipients =
                recipientRepository.findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(campaignId, "PENDING");

        if (recipients.isEmpty()) {
            // Distinguish "already sent" from "never had anyone to send to". Both used to land on
            // COMPLETED, so a campaign that dispatched nothing looked identical to a successful one.
            long total = recipientRepository.countByCampaignIdAndActiveTrue(campaignId);
            if (total == 0) {
                log.warn("[WHATSAPP][CAMPAIGN][SEND] Campaign has no recipients at all, refusing to send campaignId={}",
                        campaignId);
                throw new IllegalStateException(
                        "This campaign has no recipients, so there is nothing to send. "
                                + "Create a new campaign once the audience is populated.");
            }
            log.warn("[WHATSAPP][CAMPAIGN][SEND] No pending recipients for campaignId={} (all {} already processed)",
                    campaignId, total);
            campaign.setStatus("COMPLETED");
            campaign.setCompletedAt(OffsetDateTime.now());
            campaign.setModifiedAt(OffsetDateTime.now());
            maybeCreateLinkedEmailCampaign(campaign);
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

        // Recompute absolutely from the recipient rows rather than incrementing the counters this
        // method loaded before the send loop began. Delivery webhooks arriving mid-send also write
        // these fields; incrementing a stale in-memory value silently discarded their updates.
        // Statuses downstream of SENT (DELIVERED, READ) still count as sent — see
        // WhatsAppWebhookService.refreshCampaignCounts, which uses the same definition.
        long delivered = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "DELIVERED");
        long read = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "READ");
        long sentTotal = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "SENT")
                + delivered + read;
        long failedTotal = recipientRepository.countByCampaignIdAndStatusAndActiveTrue(campaignId, "FAILED");

        campaign.setSentCount((int) sentTotal);
        campaign.setFailedCount((int) failedTotal);
        campaign.setDeliveredCount((int) delivered);
        campaign.setReadCount((int) read);

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

        maybeCreateLinkedEmailCampaign(campaign);

        WhatsAppCampaign saved = campaignRepository.save(campaign);

        log.info("[WHATSAPP][CAMPAIGN][SEND] Finished campaignId={}, sent={}, failed={}, status={}",
                campaignId, sent, failed, saved.getStatus());

        return saved;
    }

    /**
     * If this campaign has "also email phone-less customers" enabled and hasn't already spawned
     * its linked email campaign, builds a matching email from this campaign's offer text/link/
     * image (read back from a recipient's variablesJson — the same values every recipient got)
     * and sends it. Mutates campaign.linkedEmailCampaignId but does not save it — the caller
     * persists it as part of its own save. Failures here are logged, not propagated: the
     * WhatsApp send already succeeded and must not be undone by the email side failing.
     */
    private void maybeCreateLinkedEmailCampaign(WhatsAppCampaign campaign) {
        if (!Boolean.TRUE.equals(campaign.getAlsoEmailPhoneless()) || campaign.getLinkedEmailCampaignId() != null) {
            return;
        }

        // Re-read the persisted value: the campaign instance in hand was loaded before the send
        // loop and may not reflect a linked email another run already created. Cheap insurance
        // against emailing every phone-less customer twice.
        boolean alreadyLinked = campaignRepository.findByIdAndActiveTrue(campaign.getId())
                .map(fresh -> fresh.getLinkedEmailCampaignId() != null)
                .orElse(false);
        if (alreadyLinked) {
            log.info("[WHATSAPP][CAMPAIGN][LINKED_EMAIL] campaignId={} already has a linked email, skipping",
                    campaign.getId());
            return;
        }

        try {
            List<WhatsAppCampaignRecipient> anyRecipients =
                    recipientRepository.findByCampaignIdAndActiveTrueOrderByCreatedAtAsc(campaign.getId());
            String variablesJson = anyRecipients.isEmpty() ? "" : anyRecipients.get(0).getVariablesJson();

            String offerText = getVariableValue(variablesJson, "offerText");
            String link = getVariableValue(variablesJson, "link");
            String imageUrl = getVariableValue(variablesJson, "imageUrl");

            StringBuilder body = new StringBuilder();
            if (!isBlank(imageUrl)) {
                body.append("{{IMG|").append(imageUrl).append("}}\n\n");
            }
            body.append(isBlank(offerText) ? "Check out our latest floral collections!" : offerText);
            if (!isBlank(link)) {
                body.append("\n\n{{A|Shop now|").append(link).append("}}");
            }

            EmailCampaignService.CreateCampaignRequest emailRequest = new EmailCampaignService.CreateCampaignRequest();
            emailRequest.setTitle(campaign.getTitle() + " (email — no phone on file)");
            emailRequest.setSubject(campaign.getTitle());
            emailRequest.setBodyText(body.toString());

            com.blossombuds.domain.EmailCampaign emailCampaign = emailCampaignService.createCampaign(emailRequest);
            emailCampaign = emailCampaignService.sendCampaign(emailCampaign.getId());

            campaign.setLinkedEmailCampaignId(emailCampaign.getId());
            log.info("[WHATSAPP][CAMPAIGN][LINKED_EMAIL] whatsappCampaignId={} emailCampaignId={} recipients={}",
                    campaign.getId(), emailCampaign.getId(), emailCampaign.getTotalRecipients());
        } catch (Exception ex) {
            log.warn("[WHATSAPP][CAMPAIGN][LINKED_EMAIL] Failed to create/send linked email for whatsappCampaignId={}: {}",
                    campaign.getId(), ex.toString());
        }
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
            // Opt-in, not restriction, by default: send to everyone who consented.
            //
            // 131049 is a per-recipient cap on marketing volume, weighted by engagement — not a
            // hard gate. Contacts who have never messaged the business number DO receive marketing
            // much of the time, so filtering them out by default would silently shrink the audience.
            // The filter is here for when failure rates are high and you want the reliable subset.
            boolean warmOnly = Boolean.TRUE.equals(request.getWarmOnly());
            List<CustomerWhatsAppPreference> preferences = warmOnly
                    ? preferenceRepository.findByOptedInTrueAndActiveTrueAndLastInboundAtIsNotNull()
                    : preferenceRepository.findByOptedInTrueAndActiveTrue();

            // Bulk-load customer names so personalised templates say "Hi Priya" not "Hi Customer"
            Set<Long> customerIds = preferences.stream()
                    .map(CustomerWhatsAppPreference::getCustomerId)
                    .filter(id -> id != null)
                    .collect(Collectors.toSet());
            java.util.Map<Long, String> nameById = customerRepository.findAllById(customerIds)
                    .stream()
                    .filter(c -> c.getName() != null && !c.getName().isBlank())
                    .collect(Collectors.toMap(com.blossombuds.domain.Customer::getId,
                            c -> c.getName().trim()));

            // Deduplicate by the digits actually sent to Meta. The table's unique index is on
            // customer_id, not phone, so the same number stored in two formats ("+919…" on the
            // customer row, "919…" on a manually added test row) would otherwise message that
            // person twice in one campaign.
            Set<String> seenPhones = new java.util.HashSet<>();

            for (CustomerWhatsAppPreference preference : preferences) {
                String normalizedPhone = normalizePhone(preference.getPhone());
                if (isBlank(normalizedPhone) || !seenPhones.add(normalizedPhone)) {
                    continue;
                }
                String recipientName = preference.getCustomerId() != null
                        ? nameById.getOrDefault(preference.getCustomerId(), "Customer")
                        : "Customer";
                WhatsAppCampaignRecipient recipient = new WhatsAppCampaignRecipient();
                recipient.setCampaignId(campaign.getId());
                recipient.setCustomerId(preference.getCustomerId());
                recipient.setPhone(normalizedPhone);
                recipient.setRecipientName(recipientName);
                recipient.setStatus("PENDING");
                recipient.setVariablesJson(toVariablesText(recipientName, request));
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

            // Opt-in filter, off by default — see the ALL_OPTED_IN branch for the reasoning.
            boolean warmOnly = Boolean.TRUE.equals(request.getWarmOnly());
            List<WhatsAppContact> contacts = warmOnly
                    ? whatsAppContactRepository.findByOptedInTrueAndActiveTrueAndLastInboundAtIsNotNull()
                    : whatsAppContactRepository.findByOptedInTrueAndActiveTrue();
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

            if (recipients.isEmpty()) {
                log.warn("[WHATSAPP][CAMPAIGN][EXPO] Resolved ZERO recipients — contacts={} skipped(registered)={}",
                        contacts.size(), skipped);
            } else {
                log.info("[WHATSAPP][CAMPAIGN][EXPO] contacts={} skipped(registered)={} queued={}",
                        contacts.size(), skipped, recipients.size());
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
                return unescapeVariable(part.substring(prefix.length()));
            }
        }

        return "";
    }

    /**
     * Escapes the delimiters used by {@link #toVariablesText}. Values are stored in a flat
     * "key=value;key=value" string, so an offer text like "20% off; today only" used to be
     * truncated at the semicolon — and a customer name containing ';' or '=' would corrupt every
     * variable after it, which matters now that real names are read from the database rather than
     * the literal "Customer". After escaping, no value contains a raw delimiter.
     */
    private String escapeVariable(String value) {
        if (value == null || value.isEmpty()) return "";
        return value.replace("\\", "\\\\")
                .replace(";", "\\s")
                .replace("=", "\\e");
    }

    /** Reverses {@link #escapeVariable}. Values written before escaping existed round-trip
     *  unchanged unless they contain a backslash, which none of these fields realistically do. */
    private String unescapeVariable(String value) {
        if (value == null || value.isEmpty()) return "";
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '\\' && i + 1 < value.length()) {
                char next = value.charAt(++i);
                switch (next) {
                    case 's' -> out.append(';');
                    case 'e' -> out.append('=');
                    case '\\' -> out.append('\\');
                    default -> out.append(c).append(next);
                }
            } else {
                out.append(c);
            }
        }
        return out.toString();
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

        if ("expo_outreach".equalsIgnoreCase(templateName) || "expo_outreach_v2".equalsIgnoreCase(templateName)) {
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
        return "name=" + escapeVariable(safe(name))
                + ";link=" + escapeVariable(safe(request.getLink()))
                + ";orderCode=" + escapeVariable(safe(request.getOrderCode()))
                + ";trackingNumber=" + escapeVariable(safe(request.getTrackingNumber()))
                + ";trackingLink=" + escapeVariable(safe(request.getTrackingLink()))
                + ";paymentLink=" + escapeVariable(safe(request.getPaymentLink()))
                + ";offerText=" + escapeVariable(safe(request.getOfferText()))
                + ";imageUrl=" + escapeVariable(safe(request.getImageUrl()));
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

        boolean isExpoTemplate = "expo_outreach".equalsIgnoreCase(providerTemplateName)
                || "expo_outreach_v2".equalsIgnoreCase(providerTemplateName);

        if (isExpoTemplate && !"EXPO_CONTACTS".equalsIgnoreCase(audienceType)) {
            throw new IllegalArgumentException(
                "The \"" + providerTemplateName + "\" template can only be sent to Expo Contacts, not to registered customers.");
        }

        if (!isExpoTemplate && "EXPO_CONTACTS".equalsIgnoreCase(audienceType)) {
            throw new IllegalArgumentException(
                "The \"" + providerTemplateName + "\" template can only be sent to opted-in registered customers, not to Expo Contacts.");
        }
    }

    /**
     * Explains, per audience, why nothing matched — so the admin sees a cause rather than an
     * empty campaign that later claims to have completed successfully.
     */
    private String emptyAudienceMessage(String audienceType, boolean warmOnly) {
        String filterHint = warmOnly
                ? " You have \"only send to contacts who have messaged us\" ticked — untick it to "
                  + "include everyone who opted in."
                : "";

        if ("EXPO_CONTACTS".equalsIgnoreCase(audienceType)) {
            long optedIn = whatsAppContactRepository.countByOptedInTrueAndActiveTrue();
            if (optedIn == 0) {
                return "No expo contacts are opted in. Import contacts before sending an expo campaign.";
            }
            if (warmOnly) {
                return "None of your " + optedIn + " opted-in expo contact(s) have messaged the business "
                        + "number yet." + filterHint;
            }
            return "All " + optedIn + " opted-in expo contact(s) were skipped because their phone numbers "
                    + "belong to registered customers. Expo campaigns deliberately exclude registered "
                    + "customers — reach them with the All Opted-In audience instead.";
        }
        if ("ALL_OPTED_IN".equalsIgnoreCase(audienceType)) {
            long optedIn = preferenceRepository.countByOptedInTrueAndActiveTrue();
            if (optedIn == 0) {
                return "No customers are currently opted in to WhatsApp marketing, so this campaign "
                        + "would reach nobody.";
            }
            return "None of your " + optedIn + " opted-in customer(s) matched this audience." + filterHint;
        }
        return "This campaign resolved to zero recipients.";
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

        /** When true, sending this campaign also auto-sends a matching email to customers with
         *  no phone on file. Only valid when audienceType is ALL_OPTED_IN. */
        private Boolean alsoEmailPhoneless;

        /** EXPO_CONTACTS only. Defaults to true: restrict the audience to contacts who have
         *  messaged the business number, since Meta drops marketing templates to the rest. */
        private Boolean warmOnly;
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
            return new ImportResult(0, 0, 0, 0);
        }

        // Compare by last 10 digits so "+919876543210" matches "9876543210" in customer DB
        Set<String> registeredLast10 = customerRepository.findAllRegisteredPhones()
                .stream()
                .map(this::last10)
                .collect(Collectors.toSet());

        int imported = 0, skippedRegistered = 0, skippedDuplicate = 0, reactivated = 0;

        for (ContactEntry entry : entries) {
            if (entry == null || isBlank(entry.getPhone())) continue;

            String normalized = normalizeE164(entry.getPhone());
            if (isBlank(normalized)) continue;

            if (registeredLast10.contains(last10(normalized))) {
                skippedRegistered++;
                continue;
            }

            // An existing row may be an active contact (a real duplicate) or one deactivated by a
            // STOP reply or an admin opt-out. Treating both as duplicates left opt-outs permanently
            // un-importable, with no way for the admin to re-add someone who asked to come back.
            java.util.Optional<WhatsAppContact> existing = whatsAppContactRepository.findByPhone(normalized);
            if (existing.isPresent()) {
                WhatsAppContact contact = existing.get();
                if (Boolean.TRUE.equals(contact.getOptedIn()) && Boolean.TRUE.equals(contact.getActive())) {
                    skippedDuplicate++;
                    continue;
                }
                // Re-opt-in on explicit re-import: the admin is asserting fresh consent for this batch.
                contact.setOptedIn(Boolean.TRUE);
                contact.setActive(Boolean.TRUE);
                contact.setOptedOutAt(null);
                contact.setSource(isBlank(source) ? "IMPORT" : source.trim().toUpperCase());
                if (!isBlank(entry.getName())) {
                    contact.setName(entry.getName().trim());
                }
                contact.setModifiedBy("admin");
                contact.setModifiedAt(OffsetDateTime.now());
                whatsAppContactRepository.save(contact);
                reactivated++;
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

        log.info("[WHATSAPP][CONTACTS][IMPORT] source={} imported={} reactivated={} skippedRegistered={} skippedDuplicate={}",
                source, imported, reactivated, skippedRegistered, skippedDuplicate);

        return new ImportResult(imported, skippedRegistered, skippedDuplicate, reactivated);
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
        /** Previously opted-out contacts brought back by an explicit re-import. */
        private final int reactivated;

        public ImportResult(int imported, int skippedRegistered, int skippedDuplicate, int reactivated) {
            this.imported = imported;
            this.skippedRegistered = skippedRegistered;
            this.skippedDuplicate = skippedDuplicate;
            this.reactivated = reactivated;
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
        // Inline the linked email campaign's outcome. The standalone Email Marketing page was
        // removed, so this row is the only place those results are visible.
        Integer emailTotal = null, emailSent = null, emailFailed = null;
        if (campaign.getLinkedEmailCampaignId() != null) {
            var linked = emailCampaignService.findCampaign(campaign.getLinkedEmailCampaignId());
            if (linked.isPresent()) {
                emailTotal = linked.get().getTotalRecipients();
                emailSent = linked.get().getSentCount();
                emailFailed = linked.get().getFailedCount();
            }
        }

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
                campaign.getCompletedAt(),
                campaign.getAlsoEmailPhoneless(),
                campaign.getLinkedEmailCampaignId(),
                emailTotal,
                emailSent,
                emailFailed
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