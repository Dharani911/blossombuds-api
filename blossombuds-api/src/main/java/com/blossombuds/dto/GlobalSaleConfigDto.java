package com.blossombuds.dto;

import lombok.*;

import java.math.BigDecimal;
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
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    private LocalDateTime createdAt;
    private LocalDateTime modifiedAt;
}
