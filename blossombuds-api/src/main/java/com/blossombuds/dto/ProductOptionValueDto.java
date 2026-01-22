// src/main/java/com/blossombuds/dto/ProductOptionValueDto.java
package com.blossombuds.dto;

import lombok.Data;
import java.math.BigDecimal;

/** DTO for option value under a product option. */
@Data
public class ProductOptionValueDto {
    private Long id;
    private Long optionId;
    private String valueCode;
    private String valueLabel;
    private BigDecimal priceDelta;
    private Integer sortOrder;
    private Boolean visible;
    private Boolean active;
    private BigDecimal originalPrice;
    private BigDecimal finalPrice;
    private Boolean discounted;
}
