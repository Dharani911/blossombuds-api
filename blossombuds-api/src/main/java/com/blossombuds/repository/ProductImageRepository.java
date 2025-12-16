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

    /** Loads active images for a set of product IDs sorted by productId, sortOrder, then id. */
    @org.springframework.data.jpa.repository.Query("""
  select pi
  from ProductImage pi
  where pi.active = true
    and pi.product.id in :productIds
  order by pi.product.id asc, pi.sortOrder asc, pi.id asc
""")
    List<ProductImage> findActiveForProductIds(@org.springframework.data.repository.query.Param("productIds") List<Long> productIds);

}
