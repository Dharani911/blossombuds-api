package com.blossombuds.service;

import com.blossombuds.domain.GlobalSaleConfig;
import com.blossombuds.dto.GlobalSaleConfigDto;
import com.blossombuds.dto.GlobalSaleConfigMapper;
import com.blossombuds.repository.GlobalSaleConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/** Service for managing GlobalSaleConfig (create/update/delete + validation like overlap rules). */
@Slf4j
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GlobalSaleConfigService {

    private final GlobalSaleConfigRepository globalSaleRepo;

    /** Lists all configs newest first (admin). */
    @PreAuthorize("hasRole('ADMIN')")
    public List<GlobalSaleConfigDto> listAll() {
        return globalSaleRepo.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(GlobalSaleConfigMapper::toDto)
                .toList();
    }

    /** Gets a config by id (admin). */
    @PreAuthorize("hasRole('ADMIN')")
    public GlobalSaleConfigDto getById(Long id) {
        GlobalSaleConfig g = globalSaleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("GlobalSaleConfig not found: " + id));
        return GlobalSaleConfigMapper.toDto(g);
    }

    /** Public: current effective config (or null if none). */
    public GlobalSaleConfigDto getEffectiveNowOrNull() {
        return globalSaleRepo.findEffectiveConfig(LocalDateTime.now())
                .map(GlobalSaleConfigMapper::toDto)
                .orElse(null);
    }

    /** Creates a new config (admin) with overlap validation for enabled=true. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public GlobalSaleConfigDto create(GlobalSaleConfigDto dto) {
        if (dto == null) throw new IllegalArgumentException("GlobalSaleConfigDto is required");

        assertValidPercent(dto.getPercentOff());
        assertNoOverlappingEnabledDiscount(dto, null);

        GlobalSaleConfig g = new GlobalSaleConfig();
        g.setEnabled(Boolean.TRUE.equals(dto.getEnabled()));
        g.setPercentOff(dto.getPercentOff() != null ? dto.getPercentOff() : BigDecimal.ZERO);
        g.setLabel(dto.getLabel());
        g.setStartsAt(dto.getStartsAt());
        g.setEndsAt(dto.getEndsAt());

        GlobalSaleConfig saved = globalSaleRepo.save(g);
        log.info("[DISCOUNT][CREATE][OK] id={} enabled={} pct={} window={}..{}",
                saved.getId(), saved.getEnabled(), saved.getPercentOff(), saved.getStartsAt(), saved.getEndsAt());

        return GlobalSaleConfigMapper.toDto(saved);
    }

    /** Updates an existing config (admin) with overlap validation for enabled=true. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public GlobalSaleConfigDto update(Long id, GlobalSaleConfigDto dto) {
        if (id == null) throw new IllegalArgumentException("id is required");
        if (dto == null) throw new IllegalArgumentException("GlobalSaleConfigDto is required");

        GlobalSaleConfig g = globalSaleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("GlobalSaleConfig not found: " + id));

        // build a "candidate" view of what will be saved (for overlap check)
        GlobalSaleConfigDto candidate = GlobalSaleConfigDto.builder()
                .id(id)
                .enabled(dto.getEnabled() != null ? dto.getEnabled() : g.getEnabled())
                .percentOff(dto.getPercentOff() != null ? dto.getPercentOff() : g.getPercentOff())
                .label(dto.getLabel() != null ? dto.getLabel() : g.getLabel())
                .startsAt(dto.getStartsAt() != null ? dto.getStartsAt() : g.getStartsAt())
                .endsAt(dto.getEndsAt() != null ? dto.getEndsAt() : g.getEndsAt())
                .build();

        assertValidPercent(candidate.getPercentOff());
        assertNoOverlappingEnabledDiscount(candidate, id);

        // apply patch
        if (dto.getEnabled() != null) g.setEnabled(dto.getEnabled());
        if (dto.getPercentOff() != null) g.setPercentOff(dto.getPercentOff());
        if (dto.getLabel() != null) g.setLabel(dto.getLabel());
        if (dto.getStartsAt() != null) g.setStartsAt(dto.getStartsAt());
        if (dto.getEndsAt() != null) g.setEndsAt(dto.getEndsAt());

        GlobalSaleConfig saved = globalSaleRepo.save(g);
        log.info("[DISCOUNT][UPDATE][OK] id={} enabled={} pct={} window={}..{}",
                saved.getId(), saved.getEnabled(), saved.getPercentOff(), saved.getStartsAt(), saved.getEndsAt());

        return GlobalSaleConfigMapper.toDto(saved);
    }

    /** Deletes a config (admin). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(Long id) {
        if (id == null) throw new IllegalArgumentException("id is required");
        GlobalSaleConfig g = globalSaleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("GlobalSaleConfig not found: " + id));
        globalSaleRepo.delete(g);
        log.info("[DISCOUNT][DELETE][OK] id={}", id);
    }

    // ─────────────────────────── Validation helpers ───────────────────────────

    private void assertNoOverlappingEnabledDiscount(GlobalSaleConfigDto dto, Long excludeId) {
        // Only block overlaps if admin is trying to enable this discount
        if (!Boolean.TRUE.equals(dto.getEnabled())) return;

        LocalDateTime startsAt = dto.getStartsAt();
        LocalDateTime endsAt = dto.getEndsAt();

        if (startsAt != null && endsAt != null && startsAt.isAfter(endsAt)) {
            throw new IllegalArgumentException("startsAt must be before (or equal to) endsAt");
        }

        LocalDateTime minTime = LocalDateTime.of(1970, 1, 1, 0, 0);
        LocalDateTime maxTime = LocalDateTime.of(2999, 12, 31, 23, 59, 59);

        long conflicts = globalSaleRepo.countOverlappingEnabled(startsAt, endsAt, excludeId, minTime, maxTime);
        if (conflicts > 0) {
            throw new IllegalArgumentException(
                    "This discount overlaps an existing enabled discount window. Disable the other discount or adjust the time range."
            );
        }
    }

    private void assertValidPercent(BigDecimal pct) {
        // Allow null/0 when disabled (or draft rows). But if enabled=true, we will enforce through overlap method + UI.
        if (pct == null) return;

        if (pct.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("percentOff cannot be negative");
        }
        if (pct.compareTo(new BigDecimal("100.00")) >= 0) {
            throw new IllegalArgumentException("percentOff must be < 100.00");
        }
    }
}
