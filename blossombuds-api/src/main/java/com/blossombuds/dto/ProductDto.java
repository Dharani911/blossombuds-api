// src/main/java/com/blossombuds/dto/ProductDto.java
package com.blossombuds.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** DTO for creating/returning a product. */
@Data
public class ProductDto {
    private Long id;
    private String slug;
    private String name;
    private String description;
    private BigDecimal price;
    private Boolean active;

    private Boolean visible;   // default true if null
    private Boolean featured;  // default false if null
    /** Indicates whether the product is currently in stock. */
    private Boolean inStock;


    /** Read-only: when created (useful for "new arrivals"). */
    private LocalDateTime createdAt;
}
