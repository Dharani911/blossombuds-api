// src/main/java/com/blossombuds/service/CarouselImageSettingsService.java
package com.blossombuds.service;

import com.blossombuds.dto.FeatureImageDto;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class CarouselImageSettingsService {

    private final SettingsService settings;
    private final ObjectMapper om = new ObjectMapper();

    private static final String KEY = "ui.carousel.images";

    public List<FeatureImageDto> listPublic() {
        var raw = settings.safeGet(KEY);
        if (raw == null || raw.isBlank()) return List.of();
        try {
            return om.readValue(raw, new TypeReference<List<FeatureImageDto>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    public FeatureImageDto addLocal(String key, String altText, Integer sortOrder) {
        var list = new ArrayList<>(listPublic());
        FeatureImageDto dto = new FeatureImageDto();
        dto.setKey(key);
        dto.setAltText(altText);
        dto.setSortOrder(sortOrder);
        dto.setUrl("/media/" + key);
        list.add(dto);
        list.sort(Comparator.comparing(i -> Optional.ofNullable(i.getSortOrder()).orElse(0)));
        save(list);
        return dto;
    }

    public void replaceAll(List<Map<String,Object>> items) {
        var out = new ArrayList<FeatureImageDto>();
        for (var m : items) {
            FeatureImageDto d = new FeatureImageDto();
            d.setKey(Objects.toString(m.get("key"), ""));
            d.setAltText((String)m.get("altText"));
            Object so = m.get("sortOrder");
            d.setSortOrder(so instanceof Number ? ((Number)so).intValue() : null);
            d.setUrl("/media/" + d.getKey());
            if (!d.getKey().isBlank()) out.add(d);
        }
        out.sort(Comparator.comparing(i -> Optional.ofNullable(i.getSortOrder()).orElse(0)));
        save(out);
    }

    public void remove(String key, boolean _unused) {
        var list = new ArrayList<>(listPublic());
        list.removeIf(i -> Objects.equals(i.getKey(), key));
        save(list);
    }

    private void save(List<FeatureImageDto> list) {
        try {
            settings.upsert(new com.blossombuds.dto.SettingDto(KEY, om.writeValueAsString(list), true), "system");
        } catch (Exception e) {
            throw new RuntimeException("Failed to persist carousel images", e);
        }
    }
}
