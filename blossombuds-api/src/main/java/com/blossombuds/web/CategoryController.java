package com.blossombuds.web;

import com.blossombuds.dto.CachedPage;
import com.blossombuds.dto.CategoryDto;
import com.blossombuds.dto.ProductDto;
import com.blossombuds.service.CatalogService;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
        return catalog.listCategoriesDto();
    }

    /** Get category by id (public). */
    @GetMapping("/{id}")
    public CategoryDto getCategory(@PathVariable Long id) {
        return catalog.getCategoryDto(id);
    }

    /** List products under a category with pagination (public). */
    @GetMapping("/{id}/products")
    public CachedPage<ProductDto> listProducts(@PathVariable Long id,
                                               @RequestParam(defaultValue = "0") @Min(0) int page,
                                               @RequestParam(defaultValue = "12") @Min(1) int size) {
        return catalog.listProductsByCategoryDto(id, page, size);
    }
}