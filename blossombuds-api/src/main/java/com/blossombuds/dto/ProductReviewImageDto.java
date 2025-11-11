package com.blossombuds.dto;

import lombok.Getter;
import lombok.Setter;

/** Payload for a review image attached to a product review. */
@Getter @Setter
public class ProductReviewImageDto {
    private Long id;
    private String publicId;
    private String url;
    private Integer sortOrder;
}
