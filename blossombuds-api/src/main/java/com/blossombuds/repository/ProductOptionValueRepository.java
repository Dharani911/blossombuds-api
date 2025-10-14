package com.blossombuds.repository;

import com.blossombuds.domain.ProductOptionValue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Repository for reading/writing option values. */
public interface ProductOptionValueRepository extends JpaRepository<ProductOptionValue, Long> {
    /** Lists values for an option ordered by sort order and id. */
    List<ProductOptionValue> findByOption_IdOrderBySortOrderAscIdAsc(Long optionId);
}
