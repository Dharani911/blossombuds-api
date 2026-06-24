package com.blossombuds.web;

import com.amazonaws.HttpMethod;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.GeneratePresignedUrlRequest;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import com.blossombuds.domain.CustomerWhatsAppPreference;
import com.blossombuds.dto.WhatsAppDtos;
import com.blossombuds.repository.CustomerWhatsAppPreferenceRepository;
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
import java.time.OffsetDateTime;
import java.util.Date;
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
    private final CustomerWhatsAppPreferenceRepository preferenceRepository;
    private final AmazonS3 r2Client;

    @Value("${cloudflare.r2.bucket}")
    private String bucketName;

    // 7-day presigned URL — sufficient for campaign image to remain accessible during send
    private static final long IMAGE_PRESIGN_TTL_MS = 7L * 24 * 60 * 60 * 1000;

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

    /** Lists recipients for a campaign. */
    @GetMapping("/campaigns/{campaignId}/recipients")
    public List<WhatsAppDtos.RecipientResponse> listRecipients(@PathVariable Long campaignId) {
        return whatsAppCampaignService.listRecipients(campaignId)
                .stream()
                .map(whatsAppCampaignService::toRecipientResponse)
                .toList();
    }

    /** Lists all active WhatsApp opt-in preferences for the opted-in audience selector. */
    @GetMapping("/preferences")
    public List<CustomerWhatsAppPreference> listPreferences() {
        return preferenceRepository.findByOptedInTrueAndActiveTrue();
    }

    /** Adds a manual opt-in preference for campaign testing. */
    @PostMapping("/preferences/manual")
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerWhatsAppPreference addManualPreference(@RequestBody ManualPreferenceRequest req) {
        if (req == null || req.getPhone() == null || req.getPhone().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone is required");
        }
        CustomerWhatsAppPreference pref = new CustomerWhatsAppPreference();
        pref.setPhone(req.getPhone().trim());
        pref.setCustomerId(req.getCustomerId());
        pref.setOptedIn(true);
        pref.setSource("ADMIN_MANUAL");
        pref.setOptedInAt(OffsetDateTime.now());
        pref.setActive(true);
        pref.setCreatedBy("admin");
        pref.setCreatedAt(OffsetDateTime.now());
        pref.setModifiedBy("admin");
        pref.setModifiedAt(OffsetDateTime.now());
        return preferenceRepository.save(pref);
    }

    /** Disables a WhatsApp opt-in preference. */
    @DeleteMapping("/preferences/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disablePreference(@PathVariable Long id) {
        preferenceRepository.findById(id).ifPresent(pref -> {
            pref.setOptedIn(false);
            pref.setActive(false);
            pref.setOptedOutAt(OffsetDateTime.now());
            pref.setModifiedBy("admin");
            pref.setModifiedAt(OffsetDateTime.now());
            preferenceRepository.save(pref);
        });
    }

    @Getter @Setter
    public static class ManualPreferenceRequest {
        private String phone;
        private Long customerId;
    }

    /** Uploads a campaign header image to R2 and returns a 7-day presigned URL for Meta to fetch. */
    @PostMapping(value = "/upload-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadCampaignImage(@RequestParam("file") MultipartFile file) throws IOException {
        String contentType = file.getContentType() != null ? file.getContentType() : "image/jpeg";
        String ext = contentType.contains("png") ? "png" : contentType.contains("webp") ? "webp" : "jpg";
        String key = "ui/whatsapp-campaigns/" + UUID.randomUUID() + "." + ext;

        byte[] bytes = file.getBytes();
        ObjectMetadata meta = new ObjectMetadata();
        meta.setContentType(contentType);
        meta.setContentLength(bytes.length);

        try (InputStream in = new ByteArrayInputStream(bytes)) {
            r2Client.putObject(new PutObjectRequest(bucketName, key, in, meta));
        }

        Date expiry = new Date(System.currentTimeMillis() + IMAGE_PRESIGN_TTL_MS);
        GeneratePresignedUrlRequest presignReq = new GeneratePresignedUrlRequest(bucketName, key)
                .withMethod(HttpMethod.GET)
                .withExpiration(expiry);

        return Map.of("url", r2Client.generatePresignedUrl(presignReq).toString());
    }
}