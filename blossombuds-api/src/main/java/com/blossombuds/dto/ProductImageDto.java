package com.blossombuds.dto;

import lombok.Data;

/** DTO for product image metadata. */
@Data
public class ProductImageDto {
    private Long id;
    private Long productId;
    private String publicId;
    private String url;                   // signed GET
    private String watermarkVariantUrl;   // signed GET (or same as url)
    private String altText;
    private Integer sortOrder;
    private Boolean active;
}
