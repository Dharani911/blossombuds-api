package com.blossombuds.service;

import com.blossombuds.domain.Customer;
import com.blossombuds.domain.CustomerEmailPreference;
import com.blossombuds.domain.EmailCampaign;
import com.blossombuds.domain.EmailCampaignRecipient;
import com.blossombuds.dto.EmailMarketingDtos;
import com.blossombuds.repository.CustomerEmailPreferenceRepository;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.repository.EmailCampaignRecipientRepository;
import com.blossombuds.repository.EmailCampaignRepository;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for creating and sending marketing email campaigns.
 * Audience is always the same fixed rule — active customers with no phone on file (phone/WhatsApp
 * is the priority channel; email is the fallback for the segment that can't be reached there) and
 * not unsubscribed — there is no per-campaign audience selection, unlike the WhatsApp CRM system.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailCampaignService {

    private final EmailCampaignRepository campaignRepository;
    private final EmailCampaignRecipientRepository recipientRepository;
    private final CustomerEmailPreferenceRepository preferenceRepository;
    private final CustomerRepository customerRepository;
    private final EmailService emailService;

    /** Non-final: @Value fields must be non-final when the class also uses @RequiredArgsConstructor. */
    @org.springframework.beans.factory.annotation.Value("${app.backend.baseUrl}")
    private String unsubscribeBaseUrl;

    /** Pacing between sends — Resend and most HTTP mail providers rate-limit; a small fixed
     *  delay avoids bursting the request thread. Not needed for the sub-100 recipient campaigns
     *  this audience rule typically produces, but cheap insurance if the phone-less segment grows. */
    private static final long SEND_DELAY_MS = 250;

    /**
     * On startup, reset any campaigns left in SENDING (from a previous crash/restart).
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
                    log.warn("[EMAIL][CAMPAIGN][RECOVERY] Reset stuck campaignId={} from SENDING to FAILED",
                            campaign.getId());
                });
    }

    /** Lists all active email campaigns. */
    @Transactional(readOnly = true)
    public List<EmailCampaign> listCampaigns() {
        return campaignRepository.findByActiveTrueOrderByCreatedAtDesc();
    }

    /** Lists recipients for a campaign. */
    @Transactional(readOnly = true)
    public List<EmailCampaignRecipient> listRecipients(Long campaignId) {
        if (campaignId == null) {
            throw new IllegalArgumentException("campaignId is required");
        }
        return recipientRepository.findByCampaignIdAndActiveTrueOrderByCreatedAtAsc(campaignId);
    }

    /** Creates a campaign and resolves recipients from the fixed audience rule. */
    @Transactional
    public EmailCampaign createCampaign(CreateCampaignRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Campaign request is required");
        }
        if (isBlank(request.getTitle())) {
            throw new IllegalArgumentException("Campaign title is required");
        }
        if (isBlank(request.getSubject())) {
            throw new IllegalArgumentException("Email subject is required");
        }
        if (isBlank(request.getBodyText())) {
            throw new IllegalArgumentException("Email body is required");
        }

        EmailCampaign campaign = new EmailCampaign();
        campaign.setTitle(request.getTitle().trim());
        campaign.setSubject(request.getSubject().trim());
        campaign.setBodyText(request.getBodyText());
        campaign.setStatus("DRAFT");
        campaign.setCreatedBy("admin");
        campaign.setModifiedBy("admin");
        campaign.setCreatedAt(OffsetDateTime.now());
        campaign.setModifiedAt(OffsetDateTime.now());
        campaign = campaignRepository.save(campaign);

        List<EmailCampaignRecipient> recipients = buildRecipients(campaign);
        recipientRepository.saveAll(recipients);

        campaign.setTotalRecipients(recipients.size());
        campaign.setModifiedAt(OffsetDateTime.now());
        campaign = campaignRepository.save(campaign);

        log.info("[EMAIL][CAMPAIGN][CREATE] Created campaignId={}, recipients={}",
                campaign.getId(), recipients.size());

        return campaign;
    }

    /**
     * Sends all pending recipients for a campaign.
     * Not @Transactional at the outer level — each DB write commits independently so no
     * single connection is held open across N blocking HTTP calls to the mail provider
     * (same reasoning as WhatsAppCampaignService.sendCampaign).
     */
    public EmailCampaign sendCampaign(Long campaignId) {
        if (campaignId == null) {
            throw new IllegalArgumentException("campaignId is required");
        }

        EmailCampaign campaign = campaignRepository.findByIdAndActiveTrue(campaignId)
                .orElseThrow(() -> new IllegalArgumentException("Campaign not found: " + campaignId));

        List<EmailCampaignRecipient> recipients =
                recipientRepository.findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(campaignId, "PENDING");

        if (recipients.isEmpty()) {
            log.warn("[EMAIL][CAMPAIGN][SEND] No pending recipients for campaignId={}", campaignId);
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

        for (EmailCampaignRecipient recipient : recipients) {
            // Persist SENDING before the HTTP call so a mid-loop crash leaves the row
            // in a recoverable state (startup recovery resets SENDING → PENDING for retry).
            recipient.setStatus("SENDING");
            recipient.setModifiedBy("system");
            recipient.setModifiedAt(OffsetDateTime.now());
            recipientRepository.save(recipient);

            String unsubscribeUrl = ensureUnsubscribeUrl(recipient.getCustomerId(), recipient.getEmail());
            String body = appendUnsubscribeFooter(campaign.getBodyText(), unsubscribeUrl);

            EmailService.EmailSendResult result =
                    emailService.sendMarketingEmailSync(recipient.getEmail(), campaign.getSubject(), body);

            if (result.success()) {
                recipient.setStatus("SENT");
                recipient.setSentAt(OffsetDateTime.now());
                recipient.setErrorMessage(null);
                sent++;
            } else {
                recipient.setStatus("FAILED");
                recipient.setFailedAt(OffsetDateTime.now());
                recipient.setErrorMessage(result.errorMessage());
                failed++;
            }

            recipient.setModifiedBy("system");
            recipient.setModifiedAt(OffsetDateTime.now());
            recipientRepository.save(recipient);

            sleepBetweenSends();
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

        EmailCampaign saved = campaignRepository.save(campaign);

        log.info("[EMAIL][CAMPAIGN][SEND] Finished campaignId={}, sent={}, failed={}, status={}",
                campaignId, sent, failed, saved.getStatus());

        return saved;
    }

    /** Resolves the fixed audience: active customers with no phone, an email, and not unsubscribed. */
    private List<EmailCampaignRecipient> buildRecipients(EmailCampaign campaign) {
        List<Customer> eligible = customerRepository.findMarketingEmailEligible();

        Set<Long> unsubscribedCustomerIds = preferenceRepository.findByUnsubscribedTrue()
                .stream()
                .map(CustomerEmailPreference::getCustomerId)
                .collect(Collectors.toSet());

        List<EmailCampaignRecipient> recipients = new ArrayList<>();
        int skippedUnsubscribed = 0;

        for (Customer customer : eligible) {
            if (unsubscribedCustomerIds.contains(customer.getId())) {
                skippedUnsubscribed++;
                continue;
            }

            EmailCampaignRecipient recipient = new EmailCampaignRecipient();
            recipient.setCampaignId(campaign.getId());
            recipient.setCustomerId(customer.getId());
            recipient.setEmail(customer.getEmail());
            recipient.setRecipientName(isBlank(customer.getName()) ? "there" : customer.getName().trim());
            recipient.setStatus("PENDING");
            recipient.setCreatedBy("admin");
            recipient.setModifiedBy("admin");
            recipient.setCreatedAt(OffsetDateTime.now());
            recipient.setModifiedAt(OffsetDateTime.now());
            recipients.add(recipient);
        }

        log.info("[EMAIL][CAMPAIGN][AUDIENCE] eligible={} skippedUnsubscribed={} queued={}",
                eligible.size(), skippedUnsubscribed, recipients.size());

        return recipients;
    }

    /** Finds or creates the customer's email preference row and returns their unsubscribe link.
     *  Not @Transactional: it's called via self-invocation from sendCampaign() in this same class,
     *  which bypasses Spring's transactional proxy entirely — the single save() call below is
     *  already atomic on its own via Spring Data's default per-call transaction. */
    private String ensureUnsubscribeUrl(Long customerId, String email) {
        CustomerEmailPreference pref = (customerId == null ? java.util.Optional.<CustomerEmailPreference>empty()
                        : preferenceRepository.findByCustomerId(customerId))
                .orElseGet(() -> {
                    CustomerEmailPreference p = new CustomerEmailPreference();
                    p.setCustomerId(customerId);
                    p.setEmail(email);
                    p.setUnsubscribeToken(UUID.randomUUID().toString());
                    p.setCreatedBy("system");
                    p.setCreatedAt(OffsetDateTime.now());
                    return p;
                });
        pref.setModifiedBy("system");
        pref.setModifiedAt(OffsetDateTime.now());
        pref = preferenceRepository.save(pref);

        return unsubscribeBaseUrl + "/api/public/email-preference/unsubscribe?token=" + pref.getUnsubscribeToken();
    }

    private String appendUnsubscribeFooter(String bodyText, String unsubscribeUrl) {
        return (bodyText == null ? "" : bodyText)
                + "\n\n---\n"
                + "{{A|Unsubscribe from marketing emails|" + unsubscribeUrl + "}}";
    }

    private void sleepBetweenSends() {
        try {
            Thread.sleep(SEND_DELAY_MS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /** Converts an email campaign entity into API response DTO. */
    public EmailMarketingDtos.CampaignResponse toCampaignResponse(EmailCampaign campaign) {
        return new EmailMarketingDtos.CampaignResponse(
                campaign.getId(),
                campaign.getTitle(),
                campaign.getSubject(),
                campaign.getBodyText(),
                campaign.getStatus(),
                campaign.getTotalRecipients(),
                campaign.getSentCount(),
                campaign.getFailedCount(),
                campaign.getCreatedAt(),
                campaign.getCompletedAt()
        );
    }

    /** Converts an email campaign recipient entity into API response DTO. */
    public EmailMarketingDtos.RecipientResponse toRecipientResponse(EmailCampaignRecipient recipient) {
        return new EmailMarketingDtos.RecipientResponse(
                recipient.getId(),
                recipient.getCampaignId(),
                recipient.getCustomerId(),
                recipient.getEmail(),
                recipient.getRecipientName(),
                recipient.getStatus(),
                recipient.getErrorMessage(),
                recipient.getSentAt(),
                recipient.getFailedAt()
        );
    }

    /** Request object for creating an email campaign. */
    @Getter
    @Setter
    public static class CreateCampaignRequest {
        /** Admin-facing campaign title. */
        private String title;
        /** Email subject line. */
        private String subject;
        /** Email body, using the {{A|Label|URL}} link-marker convention shared by all outgoing emails. */
        private String bodyText;
    }
}
