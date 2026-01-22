package com.blossombuds.dto;

import com.blossombuds.domain.GlobalSaleConfig;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Mapper helpers for GlobalSaleConfig <-> DTO. */
public final class GlobalSaleConfigMapper {

    private GlobalSaleConfigMapper() {}

    public static GlobalSaleConfigDto toDto(GlobalSaleConfig g) {
        if (g == null) return null;
        return GlobalSaleConfigDto.builder()
                .id(g.getId())
                .enabled(g.getEnabled())
                .percentOff(g.getPercentOff())
                .label(g.getLabel())
                .startsAt(toInstantUtc(g.getStartsAt()))
                .endsAt(toInstantUtc(g.getEndsAt()))
                .createdAt(toInstantUtc(g.getCreatedAt()))
                .modifiedAt(toInstantUtc(g.getModifiedAt()))
                .build();
    }

    private static Instant toInstantUtc(LocalDateTime ldt) {
        return ldt == null ? null : ldt.toInstant(ZoneOffset.UTC);
    }
}
