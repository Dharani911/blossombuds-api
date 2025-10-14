package com.blossombuds.repository;

import com.blossombuds.domain.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for reading/writing product images. */
public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {
    /** Lists images for a product ordered by sort order and id. */
    List<ProductImage> findByProduct_IdOrderBySortOrderAscIdAsc(Long productId);
    Optional<ProductImage> findFirstByProduct_IdAndActiveTrueOrderBySortOrderAscIdAsc(Long productId);
}
