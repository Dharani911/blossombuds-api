package com.blossombuds.web;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.S3Object;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

/**
 * Serves WhatsApp campaign header images from R2 at a stable public URL.
 * Meta's servers need a plain HTTPS URL — the R2 private endpoint presigned URLs
 * are not reliably reachable from Meta's CDN, causing silent message delivery failure.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class PublicMediaController {

    private final AmazonS3 r2Client;

    @Value("${cloudflare.r2.bucket}")
    private String bucketName;

    @GetMapping("/api/public/whatsapp-campaign/{filename}")
    public ResponseEntity<byte[]> serveWhatsAppCampaignImage(@PathVariable String filename) {
        if (filename == null || filename.isBlank() || filename.contains("/") || filename.contains("..") || filename.contains("\\")) {
            return ResponseEntity.badRequest().build();
        }

        String key = "ui/whatsapp-campaigns/" + filename;
        try {
            S3Object obj = r2Client.getObject(bucketName, key);
            byte[] bytes = obj.getObjectContent().readAllBytes();
            String ct = obj.getObjectMetadata().getContentType();
            MediaType mediaType;
            try {
                mediaType = (ct != null && !ct.isBlank()) ? MediaType.parseMediaType(ct) : MediaType.IMAGE_JPEG;
            } catch (Exception e) {
                mediaType = MediaType.IMAGE_JPEG;
            }
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .cacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic())
                    .body(bytes);
        } catch (Exception e) {
            log.warn("[PUBLIC_MEDIA] whatsapp-campaign image not found: key={} error={}", key, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }
}
