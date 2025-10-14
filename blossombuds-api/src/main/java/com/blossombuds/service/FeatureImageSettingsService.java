// src/main/java/com/blossombuds/service/FeatureImageSettingsService.java
package com.blossombuds.service;

import com.amazonaws.HttpMethod;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.CopyObjectRequest;
import com.amazonaws.services.s3.model.DeleteObjectRequest;
import com.amazonaws.services.s3.model.GeneratePresignedUrlRequest;
import com.blossombuds.domain.Setting;
import com.blossombuds.dto.FeatureImageDto;
import com.blossombuds.dto.SettingDto;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.net.URL;
import java.util.*;

/**
 * Persists feature-tile image list in Settings under key "ui.featureTiles.images".
 * Each entry (stored as JSON) is: { "key": "ui/feature_tiles/..", "altText": "...", "sortOrder": 0 }
 * Public readers get fresh signed GET URLs derived from the stored keys.
 */
@Service
@RequiredArgsConstructor
public class FeatureImageSettingsService {

    private final AmazonS3 r2;              // from CloudflareR2Config
    private final SettingsService settings; // your existing SettingsService

    private final ObjectMapper om = new ObjectMapper();

    @Value("${cloudflare.r2.bucket}")
    private String bucket;

    @Value("${cloudflare.r2.signed-ttl:3600}")
    private int signedTtlSeconds;

    private static final String SETTINGS_KEY = "ui.featureTiles.images";
    private static final String TEMP_PREFIX  = "tmp/";
    private static final String UI_PREFIX    = "ui/feature_tiles/";

    /* ───────────────────────── Public read for homepage ───────────────────────── */

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

    /* ─────────────────────── Admin flows: finalize/upload list ─────────────────── */

    /** Move tmp key → final folder, append to settings, return signed preview. */
    public FeatureImageDto addFromTempKey(String tempKey, String altText, Integer sortOrder) {
        String finalKey = moveTempToUi(tempKey);

        List<Map<String, Object>> items = readListJson();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("key", finalKey);
        if (altText != null && !altText.isBlank()) row.put("altText", altText);
        if (sortOrder != null) row.put("sortOrder", sortOrder);
        items.add(row);

        saveListJson(items);

        FeatureImageDto dto = new FeatureImageDto();
        dto.setKey(finalKey);
        dto.setAltText(altText);
        dto.setSortOrder(sortOrder);
        dto.setUrl(signGet(finalKey));
        return dto;
    }

    /** Replace entire list (expects keys + optional altText/sortOrder). */
    public void replaceAll(List<Map<String, Object>> items) {
        saveListJson(items != null ? items : List.of());
    }

    /** Remove one entry by key; optionally delete the object in R2 as well. */
    public void remove(String key, boolean deleteObject) {
        List<Map<String, Object>> items = readListJson();
        items.removeIf(m -> Objects.equals(optStr(m.get("key")), key));
        saveListJson(items);

        if (deleteObject && key != null && !key.isBlank()) {
            safeDelete(key);
        }
    }

    /* ───────────────────────────── R2 helpers ───────────────────────────── */

    private String moveTempToUi(String tempKey) {
        String tmp = normalizeTempKey(tempKey);
        String file = tmp.substring(tmp.lastIndexOf('/') + 1);
        String finalKey = UI_PREFIX + UUID.randomUUID() + "_" + file;

        r2.copyObject(new CopyObjectRequest(bucket, tmp, bucket, finalKey));
        safeDelete(tmp); // best-effort

        return finalKey;
    }

    private void safeDelete(String key) {
        try { r2.deleteObject(new DeleteObjectRequest(bucket, key)); } catch (Exception ignored) {}
    }

    private String signGet(String key) {
        Date exp = new Date(System.currentTimeMillis() + (long) signedTtlSeconds * 1000);
        GeneratePresignedUrlRequest req = new GeneratePresignedUrlRequest(bucket, key)
                .withMethod(com.amazonaws.HttpMethod.GET)
                .withExpiration(exp);
        URL url = r2.generatePresignedUrl(req);
        return url.toString();
    }

    private String normalizeTempKey(String key) {
        if (key == null) throw new IllegalArgumentException("key is required");
        String k = key.replaceFirst("^/+", "");
        return k.startsWith(TEMP_PREFIX) ? k : TEMP_PREFIX + k;
    }

    /* ─────────────────────── Settings JSON (get/save) ─────────────────────── */

    /** Read JSON array from settings (returns empty list if not found/invalid). */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> readListJson() {
        try {
            Setting s = settings.get(SETTINGS_KEY); // throws if missing
            String json = s.getValue();
            if (json == null || json.isBlank()) return new ArrayList<>();
            return om.readValue(json, new TypeReference<>() {});
        } catch (Exception ignored) {
            return new ArrayList<>();
        }
    }

    /** Persist JSON array to settings via your upsert(actor) API. */
    private void saveListJson(List<Map<String, Object>> list) {
        try {
            String json = om.writeValueAsString(list);
            SettingDto dto = new SettingDto();
            dto.setKey(SETTINGS_KEY);
            dto.setValue(json);
             dto.setActive(true); // optional, only if you use it in your DTO
            settings.upsert(dto, currentActor());
        } catch (Exception e) {
            throw new RuntimeException("Unable to save feature images setting", e);
        }
    }

    private String currentActor() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return (a != null && a.getName() != null) ? a.getName() : "system";
    }

    /* ───────────────────────── small utils ───────────────────────── */

    private static String optStr(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o);
        return s.isBlank() ? null : s;
    }

    private static Integer optInt(Object o) {
        if (o == null) return null;
        try { return Integer.valueOf(String.valueOf(o)); } catch (Exception e) { return null; }
    }
}
