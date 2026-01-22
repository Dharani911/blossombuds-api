package com.blossombuds.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

/** DTO for global sale/discount configuration. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GlobalSaleConfigDto {

    private Long id;
    private Boolean enabled;
    private BigDecimal percentOff;
    private String label;
    private Instant startsAt;
    private Instant endsAt;
    private Instant createdAt;
    private Instant modifiedAt;
}
