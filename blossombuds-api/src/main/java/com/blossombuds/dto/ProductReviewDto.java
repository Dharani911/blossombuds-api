package com.blossombuds.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** Payload for creating a product review (starts PENDING). */
@Getter @Setter
public class ProductReviewDto {
    @NotNull private Long productId;
    private Long orderId;        // optional
    private Long orderItemId;    // optional (recommended to enforce 1-per-line)
    @NotNull private Long customerId;

    @Min(1) @Max(5)
    private Short rating;

    @Size(max = 150)
    private String title;

    private String body;

    private List<ProductReviewImageDto> images; // optional
}
