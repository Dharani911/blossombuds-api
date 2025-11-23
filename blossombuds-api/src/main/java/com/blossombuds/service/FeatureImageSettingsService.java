// src/main/java/com/blossombuds/service/FeatureImageSettingsService.java
package com.blossombuds.service;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.*;
import com.blossombuds.domain.Setting;
import com.blossombuds.dto.FeatureImageDto;
import com.blossombuds.dto.SettingDto;
import com.blossombuds.util.ImageUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.URL;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Manages homepage feature tiles (no watermark).
 * Stores list in Settings key "ui.featureTiles.images" as JSON array of
 * { "key": "ui/feature_tiles/..", "altText": "...", "sortOrder": 0 }.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeatureImageSettingsService {

    private final AmazonS3 r2;              // Cloudflare R2 client
    private final SettingsService settings; // your existing SettingsService
    private final ObjectMapper om = new ObjectMapper();

    @Value("${cloudflare.r2.bucket}")
    private String bucket;

    @Value("${cloudflare.r2.signed-ttl:3600}")
    private int signedTtlSeconds;

    private static final String SETTINGS_KEY = "ui.featureTiles.images";
    private static final String TMP_PREFIX   = "uploads/tmp/";
    private static final String UI_PREFIX    = "ui/feature_tiles/";
    /** Use the same utility as products if you like; otherwise a reasonable cap. */
    private static final int MAX_DIM = ImageUtil.MAX_DIM; // or set e.g. 1600

    /* ───────────────────── Public read (homepage) ───────────────────── */

    private static final int MAX_W = 1600;
    private static final int MAX_H = 900;

    /** Upload from multipart (no presign; same flow as product images). */
    public FeatureImageDto addFromUpload(MultipartFile file, String altText, Integer sortOrder)
            throws IOException {
        log.info("[FEATURE][UPLOAD] Incoming feature image upload: fileName={}, size={}",
                file != null ? file.getOriginalFilename() : null,
                file != null ? file.getSize() : null);

        if (file == null || file.isEmpty()) {
            log.warn("[FEATURE][UPLOAD] File empty or null — rejecting upload");
            throw new IllegalArgumentException("File cannot be null or empty");
        }

        // 1) Decode using pure Java (no HEIC)
        BufferedImage decoded;
        try (InputStream in = file.getInputStream()) {
            decoded = ImageIO.read(in);
        }
        if (decoded == null) {
            log.error("[FEATURE][UPLOAD] Decoding failed — unsupported image");
            throw new IllegalArgumentException(
                    "Uploaded file is not a supported image (JPG, PNG, WebP, GIF, BMP, TIFF)");
        }

        // 2) Resize (no watermark for feature tiles)
        int FEATURE_MAX_DIM = 1600;
        BufferedImage resized = ImageUtil.fitWithin(decoded, FEATURE_MAX_DIM);
        log.info("[FEATURE][UPLOAD] Image resized to fit within {}px", FEATURE_MAX_DIM);

        // 3) Center-crop to 16:9 for consistent hero aspect
        int w = resized.getWidth(), h = resized.getHeight();
        double target = 16.0 / 9.0;
        int cropW = w;
        int cropH = (int) Math.round(w / target);
        if (cropH > h) {
            cropH = h;
            cropW = (int) Math.round(h * target);
        }
        int x = Math.max(0, (w - cropW) / 2);
        int y = Math.max(0, (h - cropH) / 2);
        BufferedImage cropped = resized.getSubimage(x, y, cropW, cropH);
        log.info("[FEATURE][UPLOAD] Image center-cropped to 16:9: {}x{}", cropW, cropH);

        // 4) Compress to JPEG using ImageUtil (no ImageMagick)
        byte[] finalBytes = ImageUtil.toJpegUnderCap(cropped);
        log.info("[FEATURE][UPLOAD] JPEG compression complete: {} bytes", finalBytes.length);

        // 5) Upload to R2
        String key = UI_PREFIX + UUID.randomUUID() + ".jpg";
        log.info("[FEATURE][UPLOAD] Uploading to R2: key={}, size={}", key, finalBytes.length);

        ObjectMetadata meta = new ObjectMetadata();
        meta.setContentType("image/jpeg");
        meta.setContentLength(finalBytes.length);
        try (InputStream in = new ByteArrayInputStream(finalBytes)) {
            r2.putObject(new PutObjectRequest(bucket, key, in, meta));
            log.info("[FEATURE][UPLOAD] Upload to R2 successful: {}", key);
        }

        // 6) Append to settings list
        List<Map<String, Object>> items = readListJson();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("key", key);
        if (altText != null && !altText.isBlank()) row.put("altText", altText);
        row.put("sortOrder", sortOrder != null ? sortOrder : items.size());
        items.add(row);
        saveListJson(items);
        log.info("[FEATURE][UPLOAD] Added entry to settings list: key={}, sortOrder={}", key, row.get("sortOrder"));

        String signed = signGet(key);
        log.info("[FEATURE][UPLOAD] Returning signed preview URL for key={}", key);

        // 7) Return signed GET for immediate preview
        FeatureImageDto dto = new FeatureImageDto();
        dto.setKey(key);
        dto.setAltText(altText);
        dto.setSortOrder(sortOrder);
        dto.setUrl(signed);
        return dto;
    }

    public List<FeatureImageDto> listPublic() {
        List<Map<String, Object>> raw = readListJson();
        List<FeatureImageDto> out = new ArrayList<>();
        for (Map<String, Object> m : raw) {
            String key = optStr(m.get("key"));
            if (key == null || key.isBlank()) continue;

            FeatureImageDto dto = new FeatureImageDto();
            dto.setKey(key);
            dto.setAltText(optStr(m.get("altText")));
            dto.setSortOrder(optInt(m.get("sortOrder")));
            dto.setUrl(signGet(key));
            out.add(dto);
        }
        out.sort(Comparator.comparingInt(a -> a.getSortOrder() != null ? a.getSortOrder() : 0));
        return out;
    }

    /* ─────────────── Admin flow: presign → process-from-temp ─────────────── */

    /** 1) Presign a browser PUT to a temp location (10 minutes). */
    public PresignResponse presignPut(String filename, String contentType) {
        String safeName = (filename == null ? "file" : filename.replaceAll("[^A-Za-z0-9._-]", "_"));
        String key = TMP_PREFIX + UUID.randomUUID() + "/" + safeName;
        Date exp = Date.from(Instant.now().plus(Duration.ofMinutes(10)));

        GeneratePresignedUrlRequest req = new GeneratePresignedUrlRequest(bucket, key)
                .withMethod(com.amazonaws.HttpMethod.PUT)
                .withExpiration(exp);
        if (contentType != null && !contentType.isBlank()) {
            req.addRequestParameter("Content-Type", contentType);
        }
        URL url = r2.generatePresignedUrl(req);
        String ct = (contentType == null || contentType.isBlank()) ? "application/octet-stream" : contentType;
        return new PresignResponse(key, url.toString(), ct);
    }

    /**
     * 2) Take a temp key, convert/resize/compress (no watermark), store to UI_PREFIX,
     * append to Settings list, and return a signed preview.
     */
    public FeatureImageDto addFromTempKey(String tempKey, String altText, Integer sortOrder) {
        log.info("[FEATURE][TEMP] Processing tempKey={}", tempKey);

        String tmp = normalizeTempKey(tempKey);
        try {
            // 1) Read tmp object from R2
            log.info("[FEATURE][TEMP] Fetching temp object from R2: {}", tmp);
            S3Object obj = r2.getObject(bucket, tmp);
            BufferedImage original;
            try (InputStream in = obj.getObjectContent()) {
                original = ImageIO.read(in);
            }
            if (original == null) {
                throw new IllegalArgumentException("Uploaded file is not a supported image");
            }

            // 2) Resize + compress (no watermark)
            BufferedImage resized = ImageUtil.fitWithin(original, ImageUtil.MAX_DIM);
            byte[] jpegBytes = ImageUtil.toJpegUnderCap(resized);
            log.info("[FEATURE][TEMP] Resized + compressed temp image ({} bytes)", jpegBytes.length);

            // 3) Upload final
            String finalKey = UI_PREFIX + UUID.randomUUID() + ".jpg";
            ObjectMetadata meta = new ObjectMetadata();
            meta.setContentType("image/jpeg");
            meta.setContentLength(jpegBytes.length);
            try (InputStream up = new ByteArrayInputStream(jpegBytes)) {
                r2.putObject(new PutObjectRequest(bucket, finalKey, up, meta));
            }
            log.info("[FEATURE][TEMP] Final image stored: {}", finalKey);

            // 4) Best-effort delete tmp
            safeDelete(tmp);
            log.info("[FEATURE][TEMP] Temp key deleted: {}", tmp);

            // 5) Append to settings
            List<Map<String, Object>> items = readListJson();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("key", finalKey);
            if (altText != null && !altText.isBlank()) row.put("altText", altText);
            if (sortOrder != null) row.put("sortOrder", sortOrder);
            items.add(row);
            saveListJson(items);
            log.info("[FEATURE][TEMP] Metadata saved for key={}", finalKey);

            // 6) Build DTO with signed GET for preview
            FeatureImageDto dto = new FeatureImageDto();
            dto.setKey(finalKey);
            dto.setAltText(altText);
            dto.setSortOrder(sortOrder);
            dto.setUrl(signGet(finalKey));
            log.info("[FEATURE][TEMP] Returning signed preview for finalKey={}", finalKey);

            return dto;

        } catch (com.amazonaws.SdkClientException | IOException e) {
            log.error("[FEATURE][TEMP] Processing failed for key={} error={}", tempKey, e.getMessage());
            throw new IllegalStateException("Failed to process uploaded image. Please re-upload.", e);
        }

    }

    /** Replace entire list (expects entries with keys already in UI_PREFIX). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void replaceAll(List<Map<String, Object>> items) {
        log.info("[FEATURE][ADMIN] Replacing full feature image list: count={}",
                items != null ? items.size() : 0);
        saveListJson(items != null ? items : List.of());
    }

    /** Remove an entry; optionally delete object from R2. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void remove(String key, boolean deleteObject) {
        log.info("[FEATURE][ADMIN] Removing key={} (deleteObject={})", key, deleteObject);
        List<Map<String, Object>> items = readListJson();

        int before = items.size();
        items.removeIf(m -> Objects.equals(optStr(m.get("key")), key));
        int after = items.size();
        log.info("[FEATURE][ADMIN] Removed key={}, before={}, after={}", key, before, after);
        saveListJson(items);
        if (deleteObject && key != null && !key.isBlank()) {
            log.info("[FEATURE][ADMIN] Deleting object from R2: key={}", key);
            safeDelete(key);
        }
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void reorder(List<String> orderedKeys) {
        log.info("[FEATURE][ADMIN] Reordering feature images using orderedKeys: count={}",
                orderedKeys != null ? orderedKeys.size() : 0);
        List<Map<String, Object>> current = readListJson();
        if (current.isEmpty()) {
            log.info("[FEATURE][ADMIN] No images to reorder");
            saveListJson(current);
            return;
        }

        // Map existing items by key for fast lookup
        Map<String, Map<String, Object>> byKey = new LinkedHashMap<>();
        for (Map<String, Object> m : current) {
            String k = optStr(m.get("key"));
            if (k != null) byKey.put(k, m);
        }

        // Build new list in requested order
        List<Map<String, Object>> next = new ArrayList<>();
        int order = 0;
        if (orderedKeys != null) {
            for (String k : orderedKeys) {
                if (k == null) continue;
                Map<String, Object> found = byKey.remove(k);
                if (found != null) {
                    found.put("sortOrder", order++);
                    next.add(found);
                }
            }
        }

        // Append any leftovers, preserving their relative order
        for (Map.Entry<String, Map<String, Object>> e : byKey.entrySet()) {
            Map<String, Object> m = e.getValue();
            m.put("sortOrder", order++);
            next.add(m);
        }

        log.info("[FEATURE][ADMIN] Completed reorder. Total reordered={}", next.size());
        saveListJson(next);
    }

    /** Update a single item’s metadata (altText and/or sortOrder). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void updateMeta(String key, String altText, Integer sortOrder) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("key is required");
        }
        log.info("[FEATURE][ADMIN] Updating meta for key={}, altText={}, sortOrder={}",
                key, altText, sortOrder);

        List<Map<String, Object>> items = readListJson();
        boolean found = false;

        for (Map<String, Object> m : items) {
            String k = optStr(m.get("key"));
            if (key.equals(k)) {
                if (altText != null) {
                    if (altText.isBlank()) m.remove("altText");
                    else m.put("altText", altText);
                }
                if (sortOrder != null) {
                    m.put("sortOrder", sortOrder);
                }
                found = true;
                break;
            }
        }

        if (!found) {
            log.warn("[FEATURE][ADMIN] Key not found during meta update: {}", key);
            throw new NoSuchElementException("Feature image not found: " + key);
        }

        // If sortOrder was changed, normalize sortOrder to 0..N-1 in display order
        items.sort(Comparator.comparingInt(o -> {
            Integer so = optInt(o.get("sortOrder"));
            return so != null ? so : Integer.MAX_VALUE;
        }));
        for (int i = 0; i < items.size(); i++) {
            items.get(i).put("sortOrder", i);
        }

        log.info("[FEATURE][ADMIN] Metadata updated and sortOrder normalized for all items");
        saveListJson(items);
    }

    /* ─────────────────────────── Helpers ─────────────────────────── */

    private String signGet(String key) {
        Date exp = new Date(System.currentTimeMillis() + (long) signedTtlSeconds * 1000);
        GeneratePresignedUrlRequest req = new GeneratePresignedUrlRequest(bucket, key)
                .withMethod(com.amazonaws.HttpMethod.GET)
                .withExpiration(exp);
        URL url = r2.generatePresignedUrl(req);
        return url.toString();
    }

    private void safeDelete(String key) {
        try { r2.deleteObject(new DeleteObjectRequest(bucket, key)); } catch (Exception ignored) {}
    }

    private String normalizeTempKey(String key) {
        if (key == null || key.isBlank()) throw new IllegalArgumentException("key is required");
        String k = key.replaceFirst("^/+", "");
        return k.startsWith(TMP_PREFIX) ? k : TMP_PREFIX + k;
    }

    private String fileNameOnly(String key) {
        if (key == null) return "file";
        int slash = key.lastIndexOf('/');
        return (slash >= 0 && slash + 1 < key.length()) ? key.substring(slash + 1) : key;
    }

    /** Read JSON array from Settings (empty list if missing/invalid). */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> readListJson() {
        try {
            Setting s = settings.get(SETTINGS_KEY);
            String json = s.getValue();
            if (json == null || json.isBlank()) return new ArrayList<>();
            return om.readValue(json, new TypeReference<>() {});
        } catch (Exception ignored) {
            return new ArrayList<>();
        }
    }

    /** Persist JSON array via SettingsService.upsert(actor). */
    private void saveListJson(List<Map<String, Object>> list) {
        try {
            String json = om.writeValueAsString(list);
            SettingDto dto = new SettingDto();
            dto.setKey(SETTINGS_KEY);
            dto.setValue(json);
            dto.setActive(true);
            settings.upsert(dto, currentActor());
        } catch (Exception e) {
            throw new RuntimeException("Unable to save feature images setting", e);
        }
    }

    private String currentActor() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return (a != null && a.getName() != null) ? a.getName() : "system";
    }

    /* ───────────────────────── Small utils ───────────────────────── */

    private static String optStr(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o);
        return s.isBlank() ? null : s;
    }

    private static Integer optInt(Object o) {
        if (o == null) return null;
        try { return Integer.valueOf(String.valueOf(o)); } catch (Exception e) { return null; }
    }

    /* Lightweight DTO for presign response */
    public record PresignResponse(String key, String url, String contentType) {}
}
