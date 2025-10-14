package com.blossombuds.repository;

import com.blossombuds.domain.ProductOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Repository for reading/writing product options. */
public interface ProductOptionRepository extends JpaRepository<ProductOption, Long> {
    /** Lists options for a product ordered by sort order and id. */
    List<ProductOption> findByProduct_IdOrderBySortOrderAscIdAsc(Long productId);
}
