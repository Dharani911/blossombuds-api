package com.blossombuds.web;

import com.blossombuds.dto.CategoryDto;
import com.blossombuds.dto.ProductListItemDto;
import com.blossombuds.service.SearchService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

/** Read-only search endpoints for products & categories. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/search")
@Validated
public class SearchController {

    private final SearchService search;

    /** Search products with optional filters (public). */
    @GetMapping("/products")
    public Page<ProductListItemDto> searchProducts(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) BigDecimal priceMin,
            @RequestParam(required = false) BigDecimal priceMax,
            @RequestParam(defaultValue = "0") @PositiveOrZero int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {

        return search.searchProducts(q, categoryId, priceMin, priceMax, page, size);
    }

    /** Search categories by name (public). */
    @GetMapping("/categories")
    public Page<CategoryDto> searchCategories(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") @PositiveOrZero int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {

        return search.searchCategories(q, page, size);
    }
}
