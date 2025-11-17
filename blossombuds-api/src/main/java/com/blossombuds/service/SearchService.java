package com.blossombuds.service;

import com.blossombuds.domain.Category;
import com.blossombuds.domain.Product;
import com.blossombuds.dto.CategoryDto;
import com.blossombuds.dto.ProductListItemDto;
import com.blossombuds.repository.CategoryRepository;
import com.blossombuds.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.math.BigDecimal;

/** Faceted product/category search with basic filtering and pagination. */
@Slf4j
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SearchService {

    private final ProductRepository productRepo;
    private final CategoryRepository categoryRepo;

    /** Searches products by term/category/price range with pagination. */
    public Page<ProductListItemDto> searchProducts(String q,
                                                   Long categoryId,
                                                   BigDecimal priceMin,
                                                   BigDecimal priceMax,
                                                   int page, int size) {
        String term = q == null ? "" : q.trim();
        int p = Math.max(page, 0);
        int s = Math.min(Math.max(size, 1), 100);

        // Normalize price range (swap if min > max)
        BigDecimal min = priceMin;
        BigDecimal max = priceMax;
        if (min != null && max != null && min.compareTo(max) > 0) {
            BigDecimal tmp = min; min = max; max = tmp;
        }
        log.info("[SEARCH][PRODUCTS] Searching products q='{}' categoryId={} min={} max={} page={} size={}",
                term, categoryId, min, max, p, s);

        Pageable pageable = PageRequest.of(p, s);
        Page<Product> products = productRepo.searchProducts(term, categoryId, min, max, pageable);
        log.info("[SEARCH][PRODUCTS] Found {} products", products.getNumberOfElements());

        return products.map(pv -> {
            ProductListItemDto dto = new ProductListItemDto();
            dto.setId(pv.getId());
            dto.setSlug(pv.getSlug());
            dto.setName(pv.getName());
            dto.setPrice(pv.getPrice());
            return dto;
        });
    }

    /** Searches active categories by (partial, case-insensitive) name with pagination. */
    public Page<CategoryDto> searchCategories(String q, int page, int size) {
        String term = q == null ? "" : q.trim();
        int p = Math.max(page, 0);
        int s = Math.min(Math.max(size, 1), 100);
        log.info("[SEARCH][CATEGORIES] Searching categories q='{}' page={} size={}", term, p, s);

        Pageable pageable = PageRequest.of(p, s, Sort.by("name").ascending());
        Page<Category> cats = categoryRepo.findByActiveTrueAndNameContainingIgnoreCase(term, pageable);
        log.info("[SEARCH][CATEGORIES] Found {} categories", cats.getNumberOfElements());

        return cats.map(c -> {
            CategoryDto dto = new CategoryDto();
            dto.setId(c.getId());
            dto.setSlug(c.getSlug());
            dto.setName(c.getName());
            dto.setActive(c.getActive());
            return dto;
        });
    }
}
