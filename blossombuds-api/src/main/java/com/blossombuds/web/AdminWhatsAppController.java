package com.blossombuds.web;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import com.blossombuds.domain.WhatsAppContact;
import com.blossombuds.dto.WhatsAppDtos;
import com.blossombuds.repository.CustomerWhatsAppPreferenceRepository;
import com.blossombuds.repository.WhatsAppContactRepository;
import com.blossombuds.domain.Setting;
import com.blossombuds.service.EmailCampaignService;
import com.blossombuds.service.MarketingConsentMigrationService;
import com.blossombuds.service.SettingsService;
import com.blossombuds.service.WhatsAppCampaignService;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Admin APIs for managing WhatsApp templates, campaigns, and recipients. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/whatsapp")
@PreAuthorize("hasRole('ADMIN')")
public class AdminWhatsAppController {

    private final WhatsAppCampaignService whatsAppCampaignService;
    private final WhatsAppContactRepository whatsAppContactRepository;
    private final CustomerWhatsAppPreferenceRepository preferenceRepository;
    private final MarketingConsentMigrationService marketingConsentMigrationService;
    private final EmailCampaignService emailCampaignService;
    private final SettingsService settingsService;
    private final AmazonS3 r2Client;

    @Value("${cloudflare.r2.bucket}")
    private String bucketName;

    @Value("${app.backend.baseUrl}")
    private String backendBaseUrl;

    /**
     * Reports whether the WhatsApp Cloud integration is configured, as booleans only.
     *
     * The admin UI previously derived this by fetching the whole settings table and inspecting
     * the raw values client-side, which shipped the access token and verify token to the browser
     * on every page load. Only the "is it set" answer is ever needed, so only that is sent.
     */
    @GetMapping("/integration-status")
    public IntegrationStatusResponse integrationStatus() {
        boolean cloudEnabled = "true".equalsIgnoreCase(settingValue("whatsapp.cloud.enabled"));
        String apiVersion = settingValue("whatsapp.cloud.api_version");
        boolean phoneNumberId = !settingValue("whatsapp.cloud.phone_number_id").isBlank();
        boolean businessAccountId = !settingValue("whatsapp.cloud.business_account_id").isBlank();
        boolean accessToken = !settingValue("whatsapp.cloud.access_token").isBlank();
        boolean verifyToken = !settingValue("whatsapp.cloud.verify_token").isBlank();

        return new IntegrationStatusResponse(
                cloudEnabled,
                apiVersion.isBlank() ? "v25.0" : apiVersion,
                phoneNumberId,
                businessAccountId,
                accessToken,
                verifyToken,
                cloudEnabled && phoneNumberId && businessAccountId && accessToken && verifyToken
        );
    }

    /** Reads a setting value, returning "" when absent so callers can treat missing as unset. */
    private String settingValue(String key) {
        try {
            Setting setting = settingsService.get(key);
            return setting == null || setting.getValue() == null ? "" : setting.getValue().trim();
        } catch (Exception e) {
            return "";
        }
    }

    /** WhatsApp Cloud readiness flags — booleans only, never credential values. */
    public record IntegrationStatusResponse(
            boolean cloudEnabled,
            String apiVersion,
            boolean phoneNumberIdConfigured,
            boolean businessAccountIdConfigured,
            boolean accessTokenConfigured,
            boolean verifyTokenConfigured,
            boolean readyForLive
    ) {}

    /** Lists active WhatsApp templates available for campaign creation. */
    @GetMapping("/templates")
    public List<WhatsAppDtos.TemplateResponse> listTemplates() {
        return whatsAppCampaignService.listActiveTemplates()
                .stream()
                .map(whatsAppCampaignService::toTemplateResponse)
                .toList();
    }

    /** Lists WhatsApp campaigns ordered by latest first. */
    @GetMapping("/campaigns")
    public List<WhatsAppDtos.CampaignResponse> listCampaigns() {
        return whatsAppCampaignService.listCampaigns()
                .stream()
                .map(whatsAppCampaignService::toCampaignResponse)
                .toList();
    }

    /** Creates a new WhatsApp campaign and prepares recipients. */
    @PostMapping("/campaigns")
    public WhatsAppDtos.CampaignResponse createCampaign(
            @RequestBody WhatsAppCampaignService.CreateCampaignRequest request
    ) {
        return whatsAppCampaignService.toCampaignResponse(
                whatsAppCampaignService.createCampaign(request)
        );
    }

    /** Sends all pending recipients for a campaign. */
    @PostMapping("/campaigns/{campaignId}/send")
    public WhatsAppDtos.CampaignResponse sendCampaign(@PathVariable Long campaignId) {
        return whatsAppCampaignService.toCampaignResponse(
                whatsAppCampaignService.sendCampaign(campaignId)
        );
    }

    /** Removes a campaign from the admin list. Soft delete — history is retained. */
    @DeleteMapping("/campaigns/{campaignId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCampaign(@PathVariable Long campaignId) {
        whatsAppCampaignService.deleteCampaign(campaignId);
    }

    /** Returns the message as a recipient would see it, with the placeholders filled in. */
    @GetMapping("/campaigns/{campaignId}/preview")
    public Map<String, String> previewCampaign(@PathVariable Long campaignId) {
        return Map.of("preview", whatsAppCampaignService.renderPreview(campaignId));
    }

    /** Lists recipients for a campaign. */
    @GetMapping("/campaigns/{campaignId}/recipients")
    public List<WhatsAppDtos.RecipientResponse> listRecipients(@PathVariable Long campaignId) {
        return whatsAppCampaignService.listRecipients(campaignId)
                .stream()
                .map(whatsAppCampaignService::toRecipientResponse)
                .toList();
    }

    /** Lists all active expo/external contacts. */
    @GetMapping("/contacts")
    public List<WhatsAppContact> listContacts() {
        return whatsAppContactRepository.findAllByActiveTrueOrderByCreatedAtDesc();
    }

    /**
     * Reachability summary for the expo audience, plus the opt-in link to put behind a QR code.
     *
     * "Reachable" means the contact has messaged the business number at least once. Meta drops
     * marketing templates to everyone else (error 131049), so this is the number that actually
     * predicts how many messages will land — not the total contact count.
     */
    @GetMapping("/contacts/reachability")
    public ContactReachabilityResponse contactReachability() {
        long optedIn = whatsAppContactRepository.countByOptedInTrueAndActiveTrue();
        long reachable = whatsAppContactRepository.countByOptedInTrueAndActiveTrueAndLastInboundAtIsNotNull();
        long customersOptedIn = preferenceRepository.countByOptedInTrueAndActiveTrue();
        long customersReachable = preferenceRepository.countByOptedInTrueAndActiveTrueAndLastInboundAtIsNotNull();

        String number = settingValue("whatsapp.cloud.own_phone_number").replaceAll("[^0-9]", "");
        String phrase = settingValue("whatsapp.optin.phrase");
        if (phrase.isBlank()) phrase = "like updates";
        String prefilled = "Hi, I'd " + phrase + " from Blossom Buds";

        String optInLink = number.isBlank() ? ""
                : "https://wa.me/" + number + "?text=" + URLEncoder.encode(prefilled, StandardCharsets.UTF_8);

        return new ContactReachabilityResponse(
                optedIn, reachable, optedIn - reachable,
                customersOptedIn, customersReachable, customersOptedIn - customersReachable,
                optInLink);
    }

    /**
     * Reachability for both marketing audiences, and the opt-in deep link to encode as a QR code.
     *
     * The `customers*` figures cover the ALL_OPTED_IN audience: website consent does not make a
     * customer reachable on WhatsApp, only messaging the business number does.
     */
    public record ContactReachabilityResponse(
            long optedIn,
            long reachable,
            long unreachable,
            long customersOptedIn,
            long customersReachable,
            long customersUnreachable,
            String optInLink
    ) {}

    /**
     * Distinct audience sizes for the campaign dashboard.
     *
     * <p>These are the number of real <em>people</em> reachable on each channel right now, not a
     * running total of past sends. The old dashboard summed every campaign's recipient count, so
     * mailing the same 100 customers in two campaigns read as 200 — misleading. These figures do
     * not double-count: {@code whatsAppOptedIn} is distinct customers opted in for WhatsApp, and
     * {@code emailAudience} is distinct customers eligible for the email fallback (no phone, has an
     * email) minus anyone unsubscribed.
     */
    @GetMapping("/campaigns/audience-summary")
    public AudienceSummaryResponse audienceSummary() {
        long whatsAppOptedIn = preferenceRepository.countByOptedInTrueAndActiveTrue();
        long emailAudience = emailCampaignService.countAudience();
        return new AudienceSummaryResponse(whatsAppOptedIn, emailAudience);
    }

    /** Distinct, de-duplicated audience sizes per channel (see {@link #audienceSummary()}). */
    public record AudienceSummaryResponse(
            long whatsAppOptedIn,
            long emailAudience
    ) {}

    /** Imports a batch of external contacts, skipping registered customers and duplicates. */
    @PostMapping("/contacts/import")
    public WhatsAppCampaignService.ImportResult importContacts(@RequestBody ImportContactsRequest req) {
        if (req == null || req.getContacts() == null || req.getContacts().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contacts list is required");
        }
        return whatsAppCampaignService.importContacts(req.getSource(), req.getContacts());
    }

    /** Manually deactivates a single expo contact (opt-out from admin). */
    @DeleteMapping("/contacts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateContact(@PathVariable Long id) {
        whatsAppContactRepository.findById(id).ifPresent(c -> {
            c.setOptedIn(false);
            c.setOptedOutAt(java.time.OffsetDateTime.now());
            c.setActive(false);
            c.setModifiedBy("admin");
            c.setModifiedAt(java.time.OffsetDateTime.now());
            whatsAppContactRepository.save(c);
        });
    }

    /** Counts customers eligible for the one-time pre-feature consent migration, without
     *  sending or writing anything — used by the admin UI to show a number before the confirm dialog. */
    @GetMapping("/consent-migration/eligible-count")
    public Map<String, Integer> countConsentMigrationEligible() {
        return Map.of("eligible", marketingConsentMigrationService.countEligible());
    }

    /** Runs the one-time consent migration: opts in customers who registered before the WhatsApp
     *  CRM existed and were never asked, and emails each one the policy-update notice. Safe to
     *  re-run — only ever touches customers with no existing preference row. */
    @PostMapping("/consent-migration/run")
    public MarketingConsentMigrationService.MigrationResult runConsentMigration() {
        return marketingConsentMigrationService.run();
    }

    @Getter @Setter
    public static class ImportContactsRequest {
        private String source;
        private List<WhatsAppCampaignService.ContactEntry> contacts;
    }

    /** Uploads a campaign header image to R2 and returns a stable public URL for Meta to fetch. */
    @PostMapping(value = "/upload-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadCampaignImage(@RequestParam("file") MultipartFile file) throws IOException {
        String contentType = file.getContentType() != null ? file.getContentType() : "image/jpeg";
        if (!MediaType.IMAGE_JPEG_VALUE.equalsIgnoreCase(contentType)
                && !MediaType.IMAGE_PNG_VALUE.equalsIgnoreCase(contentType)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "WhatsApp campaign header image must be JPEG or PNG. WebP is not supported."
            );
        }
        if (file.getSize() > 5L * 1024 * 1024) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "WhatsApp campaign header image must be 5 MB or smaller."
            );
        }
        String ext = MediaType.IMAGE_PNG_VALUE.equalsIgnoreCase(contentType) ? "png" : "jpg";
        String filename = UUID.randomUUID() + "." + ext;
        String key = "ui/whatsapp-campaigns/" + filename;

        byte[] bytes = file.getBytes();
        ObjectMetadata meta = new ObjectMetadata();
        meta.setContentType(contentType);
        meta.setContentLength(bytes.length);

        try (InputStream in = new ByteArrayInputStream(bytes)) {
            r2Client.putObject(new PutObjectRequest(bucketName, key, in, meta));
        }

        String publicUrl = backendBaseUrl + "/api/public/whatsapp-campaign/" + filename;
        return Map.of("url", publicUrl);
    }
}