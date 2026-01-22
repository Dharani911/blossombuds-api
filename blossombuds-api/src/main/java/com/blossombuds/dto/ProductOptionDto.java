// src/main/java/com/blossombuds/dto/ProductOptionDto.java
package com.blossombuds.dto;

import lombok.Data;

import java.math.BigDecimal;

/** DTO for per-product option definition. */
@Data
public class ProductOptionDto {
    private Long id;
    private Long productId;
    private String name;
    private String inputType;   // select | multiselect | text
    private Boolean required;
    private Short maxSelect;
    private Integer sortOrder;
    private Boolean visible;
    private Boolean active;
    private Boolean discounted;
    private BigDecimal discountPercentOff;
    private String discountLabel;
}
