package com.blossombuds.dto;

import com.blossombuds.service.ReviewService;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class ProductReviewDetailView {
    private Long id;
    private Long productId;
    private Long orderId;
    private Long orderItemId;
    private Long customerId;
    private String customerName;
    private Short rating;
    private String title;
    private String body;
    private String status;
    private Boolean concern;
    private LocalDateTime createdAt;
    private List<ProductReviewImageDto> images;
}
