package com.blossombuds.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** Payload for creating a product review (starts PENDING). */
@Getter @Setter
public class ProductReviewDto {
    private Long productId;
    private Long orderId;      // optional
    private Long orderItemId;  // optional
    private Long customerId;   // required
    private String customerName;
    private Short rating;      // 1..5
    private String title;      // <=200
    private String body;       // <=4000
    private Boolean concern;   // REQUIRED: customer consent/concern
    private List<ProductReviewImageDto> images; // optional (pre-uploaded)
}
