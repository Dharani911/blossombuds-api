package com.blossombuds.repository;

import com.blossombuds.domain.ProductReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

/** Repository for product reviews (active-only by @Where). */
public interface ProductReviewRepository extends JpaRepository<ProductReview, Long>, JpaSpecificationExecutor<ProductReview> {
    List<ProductReview> findByProductIdAndStatusOrderByIdDesc(Long productId, String status);
    List<ProductReview> findByCustomerIdOrderByIdDesc(Long customerId);




}
