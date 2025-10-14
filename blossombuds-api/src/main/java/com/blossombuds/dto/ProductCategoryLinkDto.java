package com.blossombuds.dto;

import lombok.Data;

/** DTO for linking/unlinking product and category. */
@Data
public class ProductCategoryLinkDto {
    private Long productId;
    private Long categoryId;
}
