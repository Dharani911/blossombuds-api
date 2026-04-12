package com.blossombuds.repository;

import com.blossombuds.domain.CartSuggestionProduct;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CartSuggestionProductRepository extends JpaRepository<CartSuggestionProduct, Long> {
    List<CartSuggestionProduct> findByActiveTrueOrderBySortOrderAscIdAsc();
    Optional<CartSuggestionProduct> findByProductId(Long productId);
    List<CartSuggestionProduct> findAllByProductIdIn(Collection<Long> productIds);
}
