package com.blossombuds.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

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

    /**
     * IDs of the selected product-option values (e.g. the chosen size/length).
     * The server uses these to resolve the authoritative price — client-supplied
     * unitPrice/lineTotal are never trusted for money. See CheckoutPricingService.
     */
    private List<Long> selectedValueIds;
    private JsonNode optionsJson;   // JSON text as stored
    private String optionsText;   // human-readable variant text
    private Boolean active;

    // Optional audit echoes if you plan to show them
    private String createdBy;
    private LocalDateTime createdAt;
    private String modifiedBy;
    private LocalDateTime modifiedAt;
}
