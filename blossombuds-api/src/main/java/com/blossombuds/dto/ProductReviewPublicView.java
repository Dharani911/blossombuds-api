package com.blossombuds.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ProductReviewPublicView {
    private Long id;
    private Long productId;
    private Short rating;
    private String title;
    private String body;
    private LocalDateTime createdAt;

    private Long customerId;
    private String customerName;

    // optional helpers for UI
    private String productName;     // if you later enrich
    private String firstImageUrl;   // signed URL for first image (optional)
}
