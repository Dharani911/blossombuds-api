package com.blossombuds.service;

import com.blossombuds.domain.Setting;
import com.blossombuds.dto.FeatureImageDto;
import com.blossombuds.dto.SettingDto;
import com.blossombuds.repository.SettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;

/** Application service for simple key/value settings (soft-delete via active=false). */
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SettingsService {

    private final SettingRepository repo;

    /** Creates or updates a setting by key (admin only). */
    @Transactional
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    public Setting upsert(SettingDto dto, String actor) {
        if (dto == null) throw new IllegalArgumentException("SettingDto is required");
        if (dto.getKey() == null || dto.getKey().trim().isEmpty()) {
            throw new IllegalArgumentException("key is required");
        }
        Setting s = repo.findByKey(dto.getKey()).orElseGet(Setting::new);
        s.setKey(dto.getKey());
        s.setValue(dto.getValue());
        if (dto.getActive() != null) s.setActive(dto.getActive());
        if (s.getId() == null) {
            s.setActive(s.getActive() != null ? s.getActive() : Boolean.TRUE);
            s.setCreatedBy(actor);
            s.setCreatedAt(OffsetDateTime.now());
        } else {
            s.setModifiedBy(actor);
            s.setModifiedAt(OffsetDateTime.now());
        }
        return repo.save(s);
    }

    /** Retrieves a setting by key (throws if not found). */
    public Setting get(String key) {
        if (key == null || key.trim().isEmpty()) {
            throw new IllegalArgumentException("key is required");
        }
        return repo.findByKey(key)
                .orElseThrow(() -> new IllegalArgumentException("Setting not found: " + key));
    }

    /** Lists all settings (relies on @Where(active=true) if present on entity). */
    public List<Setting> list() {
        return repo.findAll();
    }

    /** Soft-deletes a setting (admin only). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(String key, String actor) {
        Setting s = get(key);
        s.setActive(false);
        s.setModifiedBy(actor);
        s.setModifiedAt(OffsetDateTime.now());
    }
    public String safeGet(String key) {
        try { return get(key).getValue(); } catch (Exception e) { return null; }
    }

}
