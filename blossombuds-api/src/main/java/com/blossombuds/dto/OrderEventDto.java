package com.blossombuds.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** DTO for immutable order lifecycle events. */
@Data
public class OrderEventDto {
    private Long id;
    private Long orderId;
    private String eventType;
    private String note;
    private String createdBy;
    private LocalDateTime createdAt;
}
