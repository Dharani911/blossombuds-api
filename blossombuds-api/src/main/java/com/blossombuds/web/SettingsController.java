package com.blossombuds.web;

import com.blossombuds.domain.Setting;
import com.blossombuds.dto.FeatureImageDto;
import com.blossombuds.dto.SettingDto;
import com.blossombuds.service.CarouselImageSettingsService;
import com.blossombuds.service.FeatureImageSettingsService;
import com.blossombuds.service.FileImageService;
import com.blossombuds.service.SettingsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/** HTTP endpoints for site settings (key/value). */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/settings")
@Validated
public class SettingsController {

    private final SettingsService settings;
    private final FeatureImageSettingsService featureImages;
    private final CarouselImageSettingsService carousel;
    private final FileImageService files;

    public record SettingView(String key, String value) {}

    /** Create or update a setting by key (admin). */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public Setting upsert(@Valid @RequestBody SettingDto dto, Authentication auth) {
        return settings.upsert(dto, actor(auth));
    }

    /** Get a setting by key (admin). */
    @GetMapping("/{key}")
    //@PreAuthorize("hasRole('ADMIN')")
    public SettingView get(@PathVariable @NotBlank String key) {
        var s = settings.get(key);
        return new SettingView(s.getKey(), s.getValue()); // no lazy relations
    }

    /** List all active settings (admin). */
    @GetMapping
    //@PreAuthorize("hasRole('ADMIN')")
    public List<SettingView> list() {
        return settings.list().stream()
                .map(s -> new SettingView(s.getKey(), s.getValue()))
                .toList();
    }

    /** Soft-delete a setting by key (admin). */
    @DeleteMapping("/{key}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @NotBlank String key, Authentication auth) {
        settings.delete(key, actor(auth));
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    private String actor(Authentication auth) {
        return (auth != null && auth.getName() != null) ? auth.getName() : "system";
        // For admins authenticated via JWT, this will usually be their username.
    }

    @GetMapping("/ui/feature-images")
    public List<FeatureImageDto> listFeatureImagesPublic() {
        return featureImages.listPublic();
    }

    /* ---------- FEATURE TILES: ADMIN ---------- */

    /**
     * FE flow:
     *  1) POST /api/catalog/uploads/presign  (you already have this)
     *  2) PUT to presigned URL (browser)
     *  3) POST /api/admin/settings/feature-images/from-key?key=tmp/abc.jpg&altText=...&sortOrder=0
     */
    @PostMapping("/feature-images/from-key")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public FeatureImageDto finalizeFromTempKey(@RequestParam String key,
                                               @RequestParam(required = false) String altText,
                                               @RequestParam(required = false) Integer sortOrder) {
        return featureImages.addFromTempKey(key, altText, sortOrder);
    }

    /* ---------- PUBLIC (homepage will call this) ---------- */
    @GetMapping("/ui/carousel-images")
    public List<FeatureImageDto> listPublic() {
        return carousel.listPublic();
    }

    /* ---------- ADMIN ---------- */

    // Upload one image -> saved to disk -> added to settings
    @PostMapping(value = "/admin/carousel-images", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public FeatureImageDto upload(@RequestPart("file") @NotNull MultipartFile file,
                                  @RequestParam(required=false) String altText,
                                  @RequestParam(required=false) Integer sortOrder) throws IOException {
        var saved = files.saveFeatureTile(file);           // returns key + url (/media/…)
        return carousel.addLocal(saved.key(), altText, sortOrder);
    }

    // Replace entire array (reorder, edit altText)
    @PutMapping("/admin/carousel-images")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void replace(@RequestBody List<Map<String,Object>> items) {
        carousel.replaceAll(items);
    }

    // Delete one
    @DeleteMapping("/admin/carousel-images")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@RequestParam String key) throws IOException {
        carousel.remove(key, false);
        files.deleteFeatureTile(key);
    }
}
