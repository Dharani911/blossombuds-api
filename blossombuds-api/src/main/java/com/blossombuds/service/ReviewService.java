package com.blossombuds.service;

import com.blossombuds.domain.ProductReview;
import com.blossombuds.domain.ProductReviewImage;
import com.blossombuds.dto.ProductReviewDto;
import com.blossombuds.dto.ProductReviewImageDto;
import com.blossombuds.repository.ProductReviewImageRepository;
import com.blossombuds.repository.ProductReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/** Application service for product reviews: submit, moderate, list, and delete. */
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReviewService {

    private final ProductReviewRepository reviewRepo;
    private final ProductReviewImageRepository imageRepo;

    /** Creates a review in PENDING state and persists optional images (customer or admin). */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public ProductReview submit(ProductReviewDto dto, String actor) {
        if (dto == null) throw new IllegalArgumentException("ProductReviewDto is required");
        if (dto.getProductId() == null) throw new IllegalArgumentException("productId is required");
        if (dto.getCustomerId() == null) throw new IllegalArgumentException("customerId is required");
        if (dto.getRating() == null || dto.getRating() < 1 || dto.getRating() > 5) {
            throw new IllegalArgumentException("rating must be between 1 and 5");
        }
        // Ownership: customers may only submit on their own behalf
        ensureActorIsAdminOrCustomerSelf(actor, dto.getCustomerId());

        ProductReview r = new ProductReview();
        r.setProductId(dto.getProductId());
        r.setOrderId(dto.getOrderId());
        r.setOrderItemId(dto.getOrderItemId());
        r.setCustomerId(dto.getCustomerId());
        r.setRating(dto.getRating());
        r.setTitle(safeTrim(dto.getTitle()));
        r.setBody(safeTrim(dto.getBody()));
        r.setStatus("PENDING");
        r.setActive(Boolean.TRUE);
        r.setCreatedBy(actor);
        r.setCreatedAt(OffsetDateTime.now());
        reviewRepo.save(r);

        if (dto.getImages() != null && !dto.getImages().isEmpty()) {
            List<ProductReviewImage> batch = new ArrayList<>(dto.getImages().size());
            int idx = 0;
            for (ProductReviewImageDto imgDto : dto.getImages()) {
                if (imgDto == null) continue;
                ProductReviewImage img = new ProductReviewImage();
                img.setReviewId(r.getId());
                img.setPublicId(safeTrim(imgDto.getPublicId()));
                img.setUrl(safeTrim(imgDto.getUrl()));
                img.setSortOrder(imgDto.getSortOrder() != null ? imgDto.getSortOrder() : idx++);
                img.setActive(Boolean.TRUE);
                img.setCreatedBy(actor);
                img.setCreatedAt(OffsetDateTime.now());
                batch.add(img);
            }
            if (!batch.isEmpty()) {
                imageRepo.saveAll(batch);
            }
        }
        return r;
    }

    /** Sets status to APPROVED or REJECTED (admin only). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductReview moderate(Long reviewId, String status, String actor) {
        if (reviewId == null) throw new IllegalArgumentException("reviewId is required");
        String s = safeTrim(status);
        if (!"APPROVED".equals(s) && !"REJECTED".equals(s)) {
            throw new IllegalArgumentException("status must be APPROVED or REJECTED");
        }
        ProductReview r = reviewRepo.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));
        r.setStatus(s);
        r.setModifiedBy(actor);
        r.setModifiedAt(OffsetDateTime.now());
        return r;
    }

    /** Lists approved reviews for a product (public). */
    public List<ProductReview> listApprovedForProduct(Long productId) {
        if (productId == null) throw new IllegalArgumentException("productId is required");
        return reviewRepo.findByProductIdAndStatusOrderByIdDesc(productId, "APPROVED");
    }

    /** Lists reviews authored by a customer (that customer or admin). */
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public List<ProductReview> listByCustomer(Long customerId, String actor) {
        if (customerId == null) throw new IllegalArgumentException("customerId is required");
        ensureActorIsAdminOrCustomerSelf(actor, customerId);
        return reviewRepo.findByCustomerIdOrderByIdDesc(customerId);
    }

    /** Soft-deletes a review (active=false) (owner or admin). */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public void delete(Long reviewId, String actor) {
        if (reviewId == null) throw new IllegalArgumentException("reviewId is required");
        ProductReview r = reviewRepo.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));

        // Ownership: customers may only delete their own review
        ensureActorIsAdminOrCustomerSelf(actor, r.getCustomerId());

        r.setActive(Boolean.FALSE);
        r.setModifiedBy(actor);
        r.setModifiedAt(OffsetDateTime.now());
    }

    // ───────────────────────── helpers ─────────────────────────

    /** Trims a string, returning null if input is null. */
    private static String safeTrim(String s) {
        return s == null ? null : s.trim();
    }

    /** Ensures the actor is an admin or the same customer (based on JWT subject convention). */
    private void ensureActorIsAdminOrCustomerSelf(String actor, Long targetCustomerId) {
        if (targetCustomerId == null) throw new IllegalArgumentException("targetCustomerId is required");
        if (actor == null || actor.isBlank()) {
            throw new IllegalArgumentException("actor is required");
        }
        // Convention: customer JWT subject is "cust:<id>"; admins use another subject
        if (actor.startsWith("cust:")) {
            try {
                Long cid = Long.parseLong(actor.substring("cust:".length()));
                if (!targetCustomerId.equals(cid)) {
                    throw new IllegalArgumentException("Operation not permitted for this customer");
                }
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException("Invalid customer principal");
            }
        }
    }

    public Page<ProductReview> search(String status, String q, Pageable pageable) {
        Specification<ProductReview> spec = Specification.allOf(alwaysTrue());

        // If you soft-delete with an active flag and don’t already have @Where(active=true),
        // uncomment the next line:
        // spec = spec.and((root, cq, cb) -> cb.isTrue(root.get("active")));

        if (StringUtils.hasText(status)) {
            // If your status is an enum, map it here; otherwise compare as string (case-insensitive).
            spec = spec.and((root, cq, cb) ->
                    cb.equal(cb.upper(root.get("status")), status.trim().toUpperCase()));
        }

        if (StringUtils.hasText(q)) {
            String like = "%" + q.trim().toLowerCase() + "%";

            Specification<ProductReview> text =
                    (root, cq, cb) -> cb.or(
                            cb.like(cb.lower(root.get("title")), like),
                            cb.like(cb.lower(root.get("comment")), like)
                    );

            // Numeric exact matches for ids if q looks like a number
            Specification<ProductReview> idMatch = null;
            try {
                Long n = Long.valueOf(q.trim());
                idMatch = (root, cq, cb) -> cb.or(
                        cb.equal(root.get("productId"), n),
                        cb.equal(root.get("customerId"), n),
                        cb.equal(root.get("id"), n)
                );
            } catch (NumberFormatException ignored) {}

            spec = spec.and(text);
            if (idMatch != null) spec = spec.or(idMatch);
        }

        // Sort: by createdAt desc (if present) then id desc as fallback
        return reviewRepo.findAll(spec, pageable);
    }

    private static Specification<ProductReview> alwaysTrue() {
        return (root, cq, cb) -> cb.conjunction();
    }
}
