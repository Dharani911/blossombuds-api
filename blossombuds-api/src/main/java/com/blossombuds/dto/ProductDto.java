package com.blossombuds.dto;

import lombok.Data;
import java.math.BigDecimal;

/** DTO for creating/returning a product. */
@Data
public class ProductDto {
    private Long id;
    private String slug;
    private String name;
    private String description;
    private BigDecimal price;
    private Boolean active;
}
