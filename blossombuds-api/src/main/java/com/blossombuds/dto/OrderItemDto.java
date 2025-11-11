package com.blossombuds.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** DTO for returning/creating an order line item. */
@Data
public class OrderItemDto {
    private Long id;
    private Long orderId;
    private String productName;
    private String productSlug;
    private Long productId;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal lineTotal;
    private JsonNode optionsJson;   // JSON text as stored
    private String optionsText;   // human-readable variant text
    private Boolean active;

    // Optional audit echoes if you plan to show them
    private String createdBy;
    private LocalDateTime createdAt;
    private String modifiedBy;
    private LocalDateTime modifiedAt;
}
