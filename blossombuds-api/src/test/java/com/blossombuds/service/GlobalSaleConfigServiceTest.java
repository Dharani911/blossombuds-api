package com.blossombuds.service;

import com.blossombuds.domain.GlobalSaleConfig;
import com.blossombuds.dto.GlobalSaleConfigDto;
import com.blossombuds.dto.GlobalSaleConfigMapper;
import com.blossombuds.repository.GlobalSaleConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GlobalSaleConfigServiceTest {

    @Mock private GlobalSaleConfigRepository globalSaleRepo;

    private GlobalSaleConfigService service;

    @BeforeEach
    void setUp() {
        service = new GlobalSaleConfigService(globalSaleRepo);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // create — validation
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void create_throwsOnNullDto() {
        assertThatThrownBy(() -> service.create(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void create_throwsWhenPercentOffIsNegative() {
        GlobalSaleConfigDto dto = dto(true, new BigDecimal("-5"), now(), now().plusSeconds(3600));
        assertThatThrownBy(() -> service.create(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("negative");
    }

    @Test
    void create_throwsWhenPercentOffIs100OrMore() {
        GlobalSaleConfigDto dto = dto(true, new BigDecimal("100"), now(), now().plusSeconds(3600));
        assertThatThrownBy(() -> service.create(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("< 100");
    }

    @Test
    void create_throwsWhenStartsAtAfterEndsAt() {
        // enabled=true triggers time-window check; the startsAt>endsAt guard fires before the DB overlap check
        GlobalSaleConfigDto dto = dto(true, new BigDecimal("10"),
                now().plusSeconds(3600), now()); // ends before starts

        assertThatThrownBy(() -> service.create(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("startsAt");
    }

    @Test
    void create_throwsWhenOverlappingEnabledWindowExists() {
        GlobalSaleConfigDto dto = dto(true, new BigDecimal("15"), now(), now().plusSeconds(7200));
        when(globalSaleRepo.countOverlappingEnabled(any(), any(), isNull())).thenReturn(1L);

        assertThatThrownBy(() -> service.create(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("overlaps");
    }

    @Test
    void create_succeedsAndSaves_whenValid() {
        GlobalSaleConfigDto dto = dto(true, new BigDecimal("20"), now(), now().plusSeconds(7200));
        when(globalSaleRepo.countOverlappingEnabled(any(), any(), isNull())).thenReturn(0L);

        GlobalSaleConfig saved = entity(1L, true, new BigDecimal("20"));
        when(globalSaleRepo.save(any())).thenReturn(saved);

        GlobalSaleConfigDto result = service.create(dto);

        assertThat(result.getId()).isEqualTo(1L);
        verify(globalSaleRepo).save(any(GlobalSaleConfig.class));
    }

    @Test
    void create_disabledEntry_skipsOverlapCheck() {
        GlobalSaleConfigDto dto = dto(false, new BigDecimal("15"), now(), now().plusSeconds(3600));
        GlobalSaleConfig saved = entity(2L, false, new BigDecimal("15"));
        when(globalSaleRepo.save(any())).thenReturn(saved);

        service.create(dto);

        // overlap check must NOT be called for disabled entries
        verify(globalSaleRepo, never()).countOverlappingEnabled(any(), any(), any());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // update
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void update_throwsWhenNotFound() {
        when(globalSaleRepo.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(99L, dto(false, new BigDecimal("10"), null, null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void update_throwsOnNullId() {
        assertThatThrownBy(() -> service.update(null, dto(true, new BigDecimal("10"), null, null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("id");
    }

    @Test
    void update_appliesPatch_withoutTouchingUnprovidedFields() {
        GlobalSaleConfig existing = entity(3L, true, new BigDecimal("10"));
        existing.setLabel("Original label");
        when(globalSaleRepo.findById(3L)).thenReturn(Optional.of(existing));
        when(globalSaleRepo.countOverlappingEnabled(any(), any(), eq(3L))).thenReturn(0L);
        when(globalSaleRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // patch: only change percentOff
        GlobalSaleConfigDto patch = GlobalSaleConfigDto.builder()
                .percentOff(new BigDecimal("25"))
                .build();
        service.update(3L, patch);

        ArgumentCaptor<GlobalSaleConfig> cap = ArgumentCaptor.forClass(GlobalSaleConfig.class);
        verify(globalSaleRepo).save(cap.capture());
        assertThat(cap.getValue().getPercentOff()).isEqualByComparingTo("25");
        assertThat(cap.getValue().getLabel()).isEqualTo("Original label");  // untouched
    }

    // ──────────────────────────────────────────────────────────────────────────
    // delete
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void delete_removesEntity() {
        GlobalSaleConfig g = entity(4L, false, new BigDecimal("5"));
        when(globalSaleRepo.findById(4L)).thenReturn(Optional.of(g));

        service.delete(4L);

        verify(globalSaleRepo).delete(g);
    }

    @Test
    void delete_throwsOnNullId() {
        assertThatThrownBy(() -> service.delete(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void delete_throwsWhenNotFound() {
        when(globalSaleRepo.findById(88L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(88L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // getEffectiveNowOrNull
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void getEffectiveNowOrNull_returnsNull_whenNoneActive() {
        when(globalSaleRepo.findEffectiveConfig(any(LocalDateTime.class))).thenReturn(Optional.empty());

        GlobalSaleConfigDto result = service.getEffectiveNowOrNull();

        assertThat(result).isNull();
    }

    @Test
    void getEffectiveNowOrNull_returnsDto_whenActiveConfigExists() {
        GlobalSaleConfig active = entity(5L, true, new BigDecimal("10"));
        when(globalSaleRepo.findEffectiveConfig(any(LocalDateTime.class))).thenReturn(Optional.of(active));

        GlobalSaleConfigDto result = service.getEffectiveNowOrNull();

        assertThat(result).isNotNull();
        assertThat(result.getPercentOff()).isEqualByComparingTo("10");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private Instant now() { return Instant.now(); }

    private GlobalSaleConfigDto dto(boolean enabled, BigDecimal pct, Instant startsAt, Instant endsAt) {
        return GlobalSaleConfigDto.builder()
                .enabled(enabled)
                .percentOff(pct)
                .label("Test Sale")
                .startsAt(startsAt)
                .endsAt(endsAt)
                .build();
    }

    private GlobalSaleConfig entity(Long id, boolean enabled, BigDecimal pct) {
        GlobalSaleConfig g = new GlobalSaleConfig();
        g.setId(id);
        g.setEnabled(enabled);
        g.setPercentOff(pct);
        g.setLabel("Test Sale");
        return g;
    }
}
