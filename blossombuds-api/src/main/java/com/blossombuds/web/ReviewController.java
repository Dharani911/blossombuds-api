package com.blossombuds.web;

import com.blossombuds.domain.ProductReview;
import com.blossombuds.dto.ProductReviewDto;
import com.blossombuds.service.ReviewService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** HTTP endpoints for product reviews (submit, list, moderate, delete). */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/reviews")
@Validated
public class ReviewController {

    private final ReviewService reviews;

    /** Customer submits a review (creates PENDING). */
    @PostMapping
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductReview submit(@Valid @RequestBody ProductReviewDto dto, Authentication auth) {
        return reviews.submit(dto, actor(auth));
    }

    /** Public: list APPROVED reviews for a product. */
    @GetMapping("/product/{productId}")
    public List<ProductReview> listApproved(@PathVariable @Min(1) Long productId) {
        return reviews.listApprovedForProduct(productId);
    }

    /** Admin: moderate review to APPROVED or REJECTED. */
    @PostMapping("/{reviewId}/moderate/{status}")
    @PreAuthorize("hasRole('ADMIN')")
    public ProductReview moderate(@PathVariable @Min(1) Long reviewId,
                                  @PathVariable String status,
                                  Authentication auth) {
        return reviews.moderate(reviewId, status, actor(auth));
    }

    /** Admin: soft-delete a review. */
    @DeleteMapping("/{reviewId}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @Min(1) Long reviewId, Authentication auth) {
        reviews.delete(reviewId, actor(auth));
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<ProductReview> adminList(
            @RequestParam(required = false) String status,   // PENDING/APPROVED/REJECTED (optional)
            @RequestParam(required = false) String q,        // free text (optional)
            @PageableDefault(size = 20) Pageable pageable) {
        return reviews.search(status, q, pageable);
    }
    @GetMapping
    public Page<ProductReview> listPublic(
            @RequestParam(required = false) String q,                // optional free-text
            @PageableDefault(size = 20, sort = "createdAt,desc") Pageable pageable) {
        // Reuse your ReviewService search; force status to APPROVED
        return reviews.search("APPROVED", q, pageable);
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    private String actor(Authentication auth) {
        return (auth != null && auth.getName() != null) ? auth.getName() : "system";
    }
}
