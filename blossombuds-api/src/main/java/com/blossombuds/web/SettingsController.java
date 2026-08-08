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
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
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
        // The admin UI receives secrets masked (see list()). Saving a row the admin never retyped
        // would otherwise persist the mask over the real credential and silently break sending.
        if (isSecretKey(dto.getKey()) && SECRET_MASK.equals(dto.getValue())) {
            return settings.get(dto.getKey());
        }
        return settings.upsert(dto, actor(auth));
    }
    // Reorder only: body is ["key1","key2", ...] in desired order
    public record ReorderRequest(List<String> keys) {}

    @PutMapping(value = "/admin/feature-images/order", consumes = "application/json")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorderFeatureImages(@RequestBody ReorderRequest body) {
        featureImages.reorder(body.keys());
    }

    // (optional) Update metadata of a single entry (altText and/or sortOrder)
    @PatchMapping("/admin/feature-images/meta")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateFeatureImageMeta(@RequestParam String key,
                                       @RequestParam(required = false) String altText,
                                       @RequestParam(required = false) Integer sortOrder) {
        featureImages.updateMeta(key, altText, sortOrder);
    }


    /**
     * Get a setting by key.
     *
     * Deliberately NOT admin-only: the public storefront reads individual keys anonymously
     * (brand.whatsapp for the WhatsApp FAB, shipping.free_threshold and ui.topbanner_coupon
     * for the top banner), so requiring ADMIN here breaks the site for logged-out visitors.
     * Secrets are protected per-key instead — see {@link #isSecretKey}. Unauthenticated callers
     * get 404 rather than 403 so this cannot be used to probe which secrets exist.
     */
    @GetMapping("/{key}")
    public SettingView get(@PathVariable @NotBlank String key, Authentication auth) {
        if (isSecretKey(key) && !isAdmin(auth)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Setting not found: " + key);
        }
        var s = settings.get(key);
        return new SettingView(s.getKey(), s.getValue()); // no lazy relations
    }

    /**
     * List active settings.
     *
     * <p>The storefront reads this bulk endpoint anonymously to render policy pages, so it stays
     * public — but credential-bearing keys are filtered out for non-admins entirely (the same
     * deny-list {@link #isSecretKey} used by {@link #get}). This is what stops the WhatsApp access
     * token / app secret from being dumped to an unauthenticated caller. An admin token additionally
     * sees the secret keys, with their values masked so a compromised session leaks nothing usable.
     */
    @GetMapping
    public List<SettingView> list(Authentication auth) {
        boolean admin = isAdmin(auth);
        return settings.list().stream()
                .filter(s -> admin || !isSecretKey(s.getKey()))
                .map(s -> new SettingView(s.getKey(), maskIfSecret(s.getKey(), s.getValue())))
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

    /** Placeholder returned in place of secret values. Never persisted — see {@link #upsert}. */
    static final String SECRET_MASK = "********";

    /**
     * Substrings that mark a settings key as holding a credential. Matched rather than listed
     * exactly so a newly added secret (a payment key, another provider token) is protected by
     * default instead of leaking until someone remembers to update an allow-list.
     */
    private static final List<String> SECRET_KEY_MARKERS = List.of(
            "access_token", "verify_token", "auth_token", "authkey", "auth_key",
            "api_key", "apikey", "secret", "password", "private_key", "credential");

    /** True when a settings key holds a credential that must never reach an unauthenticated caller. */
    static boolean isSecretKey(String key) {
        if (key == null || key.isBlank()) return false;
        String lower = key.toLowerCase(Locale.ROOT);
        return SECRET_KEY_MARKERS.stream().anyMatch(lower::contains);
    }

    /** Replaces credential values with {@link #SECRET_MASK}; leaves everything else untouched. */
    private static String maskIfSecret(String key, String value) {
        if (!isSecretKey(key) || value == null || value.isBlank()) return value;
        return SECRET_MASK;
    }

    /** True when the caller holds ROLE_ADMIN. */
    private static boolean isAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities() != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
    public record PresignView(String key, String url, String contentType) {}

    @GetMapping("/ui/feature-images")
    public List<FeatureImageDto> listFeatureImagesPublic() {
        return featureImages.listPublic();
    }

    /* ---------- FEATURE TILES: ADMIN ---------- */

    @PostMapping("/admin/feature-images/presign")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public PresignView presignFeatureImage(@RequestParam String filename,
                                           @RequestParam(required = false) String contentType) {
        var p = featureImages.presignPut(filename, contentType); // uses the service method
        return new PresignView(p.key(), p.url(), p.contentType());
    }

    @PostMapping("/admin/feature-images/from-key")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public FeatureImageDto finalizeFeatureFromTempKey(@RequestParam String key,
                                                      @RequestParam(required = false) String altText,
                                                      @RequestParam(required = false) Integer sortOrder) {
        return featureImages.addFromTempKey(key, altText, sortOrder);
    }
    // Return the raw list (keys, altText, sortOrder) with fresh signed GET urls for preview
    @GetMapping("/admin/feature-images")
    @PreAuthorize("hasRole('ADMIN')")
    public List<FeatureImageDto> listFeatureImagesAdmin() {
        return featureImages.listPublic(); // same as public but signed URLs; good for admin UI previews
    }

    // Replace entire array (reorder/edit altText/sortOrder); payload is array of objects:
// [{ "key":"ui/feature_tiles/..", "altText":"...", "sortOrder":0 }, ...]
    @PutMapping("/admin/feature-images")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void replaceFeatureImages(@RequestBody List<Map<String,Object>> items) {
        featureImages.replaceAll(items);
    }

    // Delete one entry from settings; optionally remove the object in R2 (deleteObject=true)
    @DeleteMapping("/admin/feature-images")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFeatureImage(@RequestParam String key,
                                   @RequestParam(defaultValue = "false") boolean deleteObject) {
        featureImages.remove(key, deleteObject);
    }



    /* ---------- PUBLIC (homepage will call this) ---------- */
    @GetMapping("/ui/carousel-images")
    public List<FeatureImageDto> listPublic() {
        return carousel.listPublic();
    }

    /* ---------- ADMIN ---------- */

    // Upload one image -> saved to disk -> added to settings
    // --- FEATURE IMAGES (admin, multipart like product images) ---
    @PostMapping(value = "/admin/feature-images", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public FeatureImageDto uploadFeatureImage(
            @RequestPart("file") @NotNull MultipartFile file,
            @RequestParam(required = false) String altText,
            @RequestParam(required = false) Integer sortOrder
    ) throws IOException, InterruptedException {
        return featureImages.addFromUpload(file, altText, sortOrder);
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
