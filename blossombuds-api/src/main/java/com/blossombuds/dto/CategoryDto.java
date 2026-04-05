package com.blossombuds.dto;

import lombok.Data;

/** DTO for creating/returning a category. */
@Data
public class CategoryDto {
    private Long id;
    private Long parentId;
    private String slug;
    private String name;
    private Boolean active;
    private String description;
    private Integer sortOrder;

    /** Signed or fallback URL returned to frontend. */
    private String imageUrl;

    /** Stored object key in R2. */
    private String imageKey;

    /** Alt text for category image. */
    private String imageAltText;

    /** True if this category uses its own uploaded image. */
    private Boolean hasCustomImage;
}