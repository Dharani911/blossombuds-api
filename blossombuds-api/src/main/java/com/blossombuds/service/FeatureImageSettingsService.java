// src/main/java/com/blossombuds/service/FeatureImageSettingsService.java
package com.blossombuds.service;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.*;
import com.blossombuds.domain.Setting;
import com.blossombuds.dto.FeatureImageDto;
import com.blossombuds.dto.SettingDto;
import com.blossombuds.util.ImageMagickUtil;
import com.blossombuds.util.ImageUtil;
import com.blossombuds.util.MagickBridge;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
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
@Service
@RequiredArgsConstructor
public class FeatureImageSettingsService {

    private final AmazonS3 r2;              // Cloudflare R2 client
    private final SettingsService settings; // your existing SettingsService
    @Value("${app.imagemagick.cmd}")
    private String magickCmd;
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
            throws IOException, InterruptedException {

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File cannot be null or empty");
        }

        // 1) Normalize to JPEG (HEIC-safe)
        byte[] normalizedJpeg;
        try {
            normalizedJpeg = ImageMagickUtil.ensureJpeg(
                    file.getBytes(),
                    file.getOriginalFilename(),
                    file.getContentType()
            );
        } catch (Exception e) {
            // fallback like your product flow
            if (MagickBridge.looksLikeHeic(file.getContentType(), file.getOriginalFilename())) {
                normalizedJpeg = MagickBridge.heicToJpeg(file.getBytes(), magickCmd);
            } else {
                throw new IOException("Image conversion failed: " + e.getMessage(), e);
            }
        }

        // 2) Decode → resize (NO watermark for feature tiles)
        BufferedImage decoded = ImageMagickUtil.readImage(normalizedJpeg);
        if (decoded == null) throw new IllegalArgumentException("Uploaded file is not a supported image");
        int FEATURE_MAX_DIM = 1600;
        BufferedImage resized = ImageUtil.fitWithin(decoded, FEATURE_MAX_DIM);

// center-crop to 16:9 if you want consistent tile aspect
        int w = resized.getWidth(), h = resized.getHeight();
        double target = 16.0 / 9.0;
        int cropW = w, cropH = (int)Math.round(w / target);
        if (cropH > h) { cropH = h; cropW = (int)Math.round(h * target); }
        int x = Math.max(0, (w - cropW) / 2);
        int y = Math.max(0, (h - cropH) / 2);
        BufferedImage cropped = resized.getSubimage(x, y, cropW, cropH);

// then compress `cropped` instead of `resized`
        byte[] finalBytes;
        try {
            finalBytes = ImageMagickUtil.targetSizeJpeg(cropped);
        } catch (Exception ce) {
            finalBytes = toJpegBytes(cropped, 0.82f);
        }

        // 4) Upload to R2
        String key = UI_PREFIX + UUID.randomUUID() + ".jpg";
        ObjectMetadata meta = new ObjectMetadata();
        meta.setContentType("image/jpeg");
        meta.setContentLength(finalBytes.length);
        try (InputStream in = new ByteArrayInputStream(finalBytes)) {
            r2.putObject(new PutObjectRequest(bucket, key, in, meta));
        }

        // 5) Append to settings list (like addFromTempKey does)
        List<Map<String, Object>> items = readListJson();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("key", key);
        if (altText != null && !altText.isBlank()) row.put("altText", altText);
        row.put("sortOrder", sortOrder != null ? sortOrder : items.size());
        items.add(row);
        saveListJson(items);

        // 6) Return signed GET for immediate preview
        FeatureImageDto dto = new FeatureImageDto();
        dto.setKey(key);
        dto.setAltText(altText);
        dto.setSortOrder(sortOrder);
        dto.setUrl(signGet(key));
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
        String tmp = normalizeTempKey(tempKey);
        try {
            // 1) Read tmp object from R2
            com.amazonaws.services.s3.model.S3Object obj = r2.getObject(bucket, tmp);
            BufferedImage original;
            try (InputStream in = obj.getObjectContent()) {
                original = javax.imageio.ImageIO.read(in);
            }
            if (original == null) {
                throw new IllegalArgumentException("Uploaded file is not a supported image");
            }

            // 2) Resize + compress (no watermark)
            BufferedImage resized = ImageUtil.fitWithin(original, ImageUtil.MAX_DIM);
            byte[] jpegBytes = ImageUtil.toJpegUnderCap(resized);

            // 3) Upload final
            String finalKey = UI_PREFIX + UUID.randomUUID() + ".jpg";
            var meta = new com.amazonaws.services.s3.model.ObjectMetadata();
            meta.setContentType("image/jpeg");
            meta.setContentLength(jpegBytes.length);
            try (InputStream up = new java.io.ByteArrayInputStream(jpegBytes)) {
                r2.putObject(new com.amazonaws.services.s3.model.PutObjectRequest(bucket, finalKey, up, meta));
            }

            // 4) Best-effort delete tmp
            safeDelete(tmp);

            // 5) Append to settings
            List<Map<String, Object>> items = readListJson();
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("key", finalKey);
            if (altText != null && !altText.isBlank()) row.put("altText", altText);
            if (sortOrder != null) row.put("sortOrder", sortOrder);
            items.add(row);
            saveListJson(items);


            // 6) Build DTO with signed GET for preview
            FeatureImageDto dto = new FeatureImageDto();
            dto.setKey(finalKey);
            dto.setAltText(altText);
            dto.setSortOrder(sortOrder);
            dto.setUrl(signGet(finalKey));
            return dto;

        } catch (com.amazonaws.SdkClientException | java.io.IOException e) {
            // log.error("addFromTempKey failed for key={}", tempKey, e);
            throw new IllegalStateException("Failed to process uploaded image. Please re-upload.", e);
        }

    }



    /** Replace entire list (expects entries with keys already in UI_PREFIX). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void replaceAll(List<Map<String, Object>> items) {
        saveListJson(items != null ? items : List.of());
    }

    /** Remove an entry; optionally delete object from R2. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void remove(String key, boolean deleteObject) {
        List<Map<String, Object>> items = readListJson();
        items.removeIf(m -> Objects.equals(optStr(m.get("key")), key));
        saveListJson(items);
        if (deleteObject && key != null && !key.isBlank()) {
            safeDelete(key);
        }
    }
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void reorder(List<String> orderedKeys) {
        List<Map<String, Object>> current = readListJson();
        if (current.isEmpty()) {
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

        saveListJson(next);
    }

    /** Update a single item’s metadata (altText and/or sortOrder). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void updateMeta(String key, String altText, Integer sortOrder) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("key is required");
        }
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

    /* ─────────────────── Image conversion/compression ─────────────────── */

    private static String guessContentType(String name, String fallback) {
        if (name == null) return fallback;
        String n = name.toLowerCase();
        if (n.endsWith(".heic") || n.endsWith(".heif")) return "image/heic";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".webp")) return "image/webp";
        if (n.endsWith(".tif") || n.endsWith(".tiff")) return "image/tiff";
        if (n.endsWith(".bmp")) return "image/bmp";
        if (n.endsWith(".gif")) return "image/gif";
        return fallback;
    }

    private byte[] convertAnyToJpegBytes(byte[] raw, String filename, String contentType) throws IOException {
        String ct = (contentType == null || contentType.isBlank())
                ? guessContentType(filename, "application/octet-stream")
                : contentType;
        try {
            return ImageMagickUtil.ensureJpeg(raw, filename, ct);
        } catch (Exception primaryFail) {
            if (MagickBridge.looksLikeHeic(ct, filename)) {
                try {
                    return MagickBridge.heicToJpeg(raw, System.getenv("MAGICK_CMD")); // or inject if you prefer
                } catch (Exception magickFail) {
                    throw new IOException("Image conversion failed (HEIC). " + primaryFail.getMessage(), magickFail);
                }
            }
            throw new IOException("Image conversion failed. " + primaryFail.getMessage(), primaryFail);
        }
    }

    private byte[] toJpegBytes(BufferedImage image, float quality) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageWriter jpgWriter = ImageIO.getImageWritersByFormatName("jpg").next();
        ImageWriteParam param = jpgWriter.getDefaultWriteParam();
        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(quality);

        try (ImageOutputStream ios = ImageIO.createImageOutputStream(baos)) {
            jpgWriter.setOutput(ios);
            jpgWriter.write(null, new IIOImage(image, null, null), param);
        } finally {
            jpgWriter.dispose();
        }
        return baos.toByteArray();
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
