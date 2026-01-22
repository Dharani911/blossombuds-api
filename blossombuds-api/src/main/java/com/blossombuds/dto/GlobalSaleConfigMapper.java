package com.blossombuds.dto;

import com.blossombuds.domain.GlobalSaleConfig;

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
                .startsAt(g.getStartsAt())
                .endsAt(g.getEndsAt())
                .createdAt(g.getCreatedAt())
                .modifiedAt(g.getModifiedAt())
                .build();
    }
}
