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

    /** If true, this product does not receive global discount. */
    private Boolean excludeFromGlobalDiscount;

    /** UI helpers: strike + final price (computed). */
    private BigDecimal originalPrice;
    private BigDecimal finalPrice;
    private BigDecimal discountPercentOff;
    private String discountLabel;

    /** True if a discount is actually applied to finalPrice. */
    private Boolean discounted;
    /** Read-only: when created (useful for "new arrivals"). */
    private LocalDateTime createdAt;
}
