package com.blossombuds.web;

import com.blossombuds.domain.Category;
import com.blossombuds.domain.Product;
import com.blossombuds.dto.CachedPage;
import com.blossombuds.dto.CategoryDto;
import com.blossombuds.dto.ProductDto;
import com.blossombuds.dto.ProductListItemDto;
import com.blossombuds.service.CatalogService;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/** Public HTTP endpoints for category listing and category → products. */
@RestController
@RequestMapping("/api/catalog/categories")
@RequiredArgsConstructor
@Validated
public class CategoryController {

    private final CatalogService catalog;

    /** List all active categories (public). */
    @GetMapping
    public List<CategoryDto> listCategories() {
        return catalog.listCategoriesDto(); // ✅ uses @Cacheable
    }

    /** List products under a category with pagination (public). */
    @GetMapping("/{id}/products")
    public CachedPage<ProductDto> listProducts(@PathVariable Long id,
                                               @RequestParam(defaultValue = "0") @Min(0) int page,
                                               @RequestParam(defaultValue = "12") @Min(1) int size) {
        return catalog.listProductsByCategoryDto(id, page, size);
    }

}
