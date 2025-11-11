package com.blossombuds.repository;

import com.blossombuds.domain.ProductReviewImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Repository for product review images (active-only by @Where). */
public interface ProductReviewImageRepository extends JpaRepository<ProductReviewImage, Long> {
    List<ProductReviewImage> findByReviewIdOrderBySortOrderAscIdAsc(Long reviewId);
    // ProductReviewImageRepository
    List<ProductReviewImage> findByReviewIdAndActiveTrueOrderBySortOrderAsc(Long reviewId);

}
