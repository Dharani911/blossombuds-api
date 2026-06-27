package com.blossombuds.web;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import com.blossombuds.domain.WhatsAppContact;
import com.blossombuds.dto.WhatsAppDtos;
import com.blossombuds.repository.WhatsAppContactRepository;
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
    private final AmazonS3 r2Client;

    @Value("${cloudflare.r2.bucket}")
    private String bucketName;

    @Value("${app.backend.baseUrl}")
    private String backendBaseUrl;

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

    /** Lists all active expo/external contacts. */
    @GetMapping("/contacts")
    public List<WhatsAppContact> listContacts() {
        return whatsAppContactRepository.findAllByActiveTrueOrderByCreatedAtDesc();
    }

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