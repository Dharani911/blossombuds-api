// src/main/java/com/blossombuds/dto/ProductOptionWithValuesDto.java
package com.blossombuds.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/** DTO for a product option along with its values (storefront payload). */
@Data
public class ProductOptionWithValuesDto {

    private Long id;
    private Long productId;
    private String name;
    private String inputType;
    private Boolean required;
    private Short maxSelect;
    private Integer sortOrder;
    private Boolean visible;
    private Boolean active;

    /** UI helpers: discount context for this option (same for all values). */
    private Boolean discounted;
    private BigDecimal discountPercentOff;
    private String discountLabel;

    /** Values under this option. */
    private List<ProductOptionValueDto> values = new ArrayList<>();
}
