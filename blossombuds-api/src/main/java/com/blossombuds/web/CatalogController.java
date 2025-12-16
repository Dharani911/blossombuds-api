package com.blossombuds.web;

import com.blossombuds.domain.*;
import com.blossombuds.dto.*;
import com.blossombuds.service.CatalogService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import java.io.IOException;
import java.util.List;

/**
 * HTTP endpoints for catalog: products, product-category links,
 * images, options and option values. Soft-deletes everywhere (active=false).
 *
 * NOTE: Category READ endpoints are handled by CategoryController to avoid mapping conflicts.
 * Category CREATE/UPDATE/DELETE remain here under /api/catalog/categories/**.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/catalog")
@Validated
public class CatalogController {

    private final CatalogService catalog;

    // ────────────────────────────── Categories (admin ops) ───────────────────

    /** Create category. */
    @PostMapping("/categories")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryDto createCategory(@Valid @RequestBody CategoryDto dto) {
        return catalog.createCategory(dto);
    }

    /** Get category by id (read: public). */
    @GetMapping("/categories/{id}")
    public CategoryDto getCategory(@PathVariable Long id) {
        return catalog.getCategoryDto(id);
    }

    /** Update category. */
    @PutMapping("/categories/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CategoryDto updateCategory(@PathVariable Long id, @Valid @RequestBody CategoryDto dto) {
        return catalog.updateCategory(id, dto);
    }

    /** Soft-delete category (active=false). */
    @DeleteMapping("/categories/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@PathVariable Long id) {
        catalog.deleteCategory(id);
    }

    // ─────────────────────────────── Products ────────────────────────────────

    /** Create product. */
    @PostMapping("/products")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductDto createProduct(@Valid @RequestBody ProductDto dto) {
        return catalog.createProduct(dto);
    }

    /** List all active products (read: public). */
    @GetMapping("/products")
    public CachedPage<ProductDto> listProducts(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) int size,
            @RequestParam(defaultValue = "createdAt") String sort,
            @RequestParam(defaultValue = "DESC") String dir
    ) {
        return catalog.listProductsDto(page, size, sort, dir);
    }


    /** NEW: New-arrival products (sorted by createdAt DESC, active via @Where). */
    @GetMapping("/products/new-arrivals")
    public List<ProductDto> newArrivals(@RequestParam(defaultValue = "12") @Min(1) int limit) {
        return catalog.listNewArrivalsDto(limit);
    }


    /** Get product by id (read: public). */
    @GetMapping("/products/{id}")
    public ProductDto getProduct(@PathVariable Long id) {
        return catalog.getProductDto(id);
    }


    /** Update product. */
    @PutMapping("/products/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ProductDto updateProduct(@PathVariable Long id, @Valid @RequestBody ProductDto dto) {
        return catalog.updateProduct(id, dto);
    }

    /** Soft-delete product (active=false). */
    @DeleteMapping("/products/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProduct(@PathVariable Long id) {
        catalog.deleteProduct(id);
    }

    // ─────────────────────── Product ↔ Category links ────────────────────────

    /** Link product to category (idempotent). */
    @PostMapping("/products/{productId}/categories/{categoryId}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void linkProductToCategory(@PathVariable Long productId, @PathVariable Long categoryId) {
        catalog.linkProductToCategory(productId, categoryId);
    }

    /** Unlink product from category. */
    @DeleteMapping("/products/{productId}/categories/{categoryId}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlinkProductFromCategory(@PathVariable Long productId, @PathVariable Long categoryId) {
        catalog.unlinkProductFromCategory(productId, categoryId);
    }

    /** List categories for a product (read: public). */
    @GetMapping("/products/{productId}/categories")
    public List<Category> listCategoriesForProduct(@PathVariable Long productId) {
        return catalog.listCategoriesForProduct(productId);
    }

    // ───────────────────────────────── Images ────────────────────────────────

    /** Upload + create image (returns signed URLs). */
    @PostMapping(value = "/products/{productId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ProductImageDto addProductImage(
            @PathVariable Long productId,
            @RequestParam(required = false) String altText,
            @RequestParam(required = false) Integer sortOrder,
            MultipartHttpServletRequest request
    ) throws IOException, InterruptedException {

        // Request-level visibility
        log.info("POST /products/{}/images: reqContentType={}", productId, request.getContentType());
        log.info("Request params: altText='{}', sortOrder='{}'", altText, sortOrder);

        var names = request.getFileMap().keySet();
        log.info("Multipart file field names: {}", names);

        request.getFileMap().forEach((k, v) -> {
            if (v != null) {
                log.info("Part[{}]: originalFilename='{}', contentType='{}', size={}",
                        k, v.getOriginalFilename(), v.getContentType(), v.getSize());
            } else {
                log.info("Part[{}]: <null>", k);
            }
        });

        MultipartFile file =
                firstNonEmpty(
                        request.getFile("file"),
                        request.getFile("image"),
                        request.getFile("upload"),
                        request.getFile("photo")
                );

        if (file == null) {
            for (MultipartFile mf : request.getFileMap().values()) {
                if (mf != null && !mf.isEmpty()) { file = mf; break; }
            }
        }

        if (file == null) {
            log.warn("No non-empty file part found. Rejecting request.");
            throw new IllegalArgumentException("No file part found in multipart request");
        }

        log.info("Chosen part: originalFilename='{}', contentType='{}', size={}",
                file.getOriginalFilename(), file.getContentType(), file.getSize());

        try {
            byte[] peek = file.getBytes();
            int head = Math.min(peek.length, 16);
            StringBuilder hex = new StringBuilder();
            for (int i = 0; i < head; i++) hex.append(String.format("%02X ", peek[i]));
            log.info("File head ({} bytes): {}", head, hex.toString().trim());
        } catch (Exception ex) {
            log.warn("Could not peek file bytes: {}", ex.toString());
        }

        ProductImage saved = catalog.addProductImage(
                productId,
                file,
                altText,
                (sortOrder != null ? sortOrder : 0)
        );

        log.info("Saved image id={}, publicId={}, sortOrder={}",
                saved.getId(), saved.getPublicId(), saved.getSortOrder());

        return catalog.toResponse(saved);
    }

    private static MultipartFile firstNonEmpty(MultipartFile... arr) {
        if (arr == null) return null;
        for (MultipartFile mf : arr) {
            if (mf != null && !mf.isEmpty()) return mf;
        }
        return null;
    }

    /** List images (each item contains a short-lived signed URL). */
    @GetMapping("/products/{productId}/images")
    public List<ProductImageDto> listImages(@PathVariable Long productId) {
        return catalog.listProductImageResponses(productId);
    }

    /** Update metadata and/or replace file (returns fresh signed URLs). */
    @PutMapping(value = "/products/{productId}/images/{imageId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ProductImageDto updateImage(
            @PathVariable Long productId,
            @PathVariable Long imageId,
            @RequestParam(required = false) String altText,
            @RequestParam(required = false) Integer sortOrder,
            @RequestParam(required = false) Boolean active,
            MultipartHttpServletRequest request
    ) throws IOException, InterruptedException {

        MultipartFile file =
                (request.getFile("file")   != null && !request.getFile("file").isEmpty())   ? request.getFile("file")   :
                        (request.getFile("image")  != null && !request.getFile("image").isEmpty())  ? request.getFile("image")  :
                                (request.getFile("upload") != null && !request.getFile("upload").isEmpty()) ? request.getFile("upload") :
                                        (request.getFile("photo")  != null && !request.getFile("photo").isEmpty())  ? request.getFile("photo")  :
                                                null;

        if (file == null) {
            for (MultipartFile mf : request.getFileMap().values()) {
                if (mf != null && !mf.isEmpty()) { file = mf; break; }
            }
        }

        ProductImageDto dto = new ProductImageDto();
        dto.setId(imageId);
        dto.setProductId(productId);
        dto.setAltText(altText);
        dto.setSortOrder(sortOrder);
        dto.setActive(active);

        ProductImage saved= catalog.updateProductImage(dto, file);
        return catalog.toResponse(saved);
    }

    /** Delete an image (soft delete). */
    @DeleteMapping("/products/{productId}/images/{imageId}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteImage(@PathVariable Long productId, @PathVariable Long imageId) {
        catalog.deleteProductImage(productId, imageId);
    }

    /** Mark an image as primary for the product. */
    @PostMapping("/products/{productId}/images/{imageId}/primary")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setPrimaryImage(@PathVariable Long productId, @PathVariable Long imageId) {
        catalog.setPrimaryImage(productId, imageId);
    }

    // Presign direct upload
    @PostMapping("/uploads/presign")
    @PreAuthorize("hasRole('ADMIN')")
    public PresignResponse presignUpload(@RequestParam String filename,
                                         @RequestParam(required=false) String contentType) {
        return catalog.presignPut(filename, contentType);
    }

    // Consume temp key, process & attach to product
    @PostMapping("/products/{productId}/images/from-key")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductImageDto addImageFromKey(@PathVariable Long productId,
                                           @RequestParam String key,
                                           @RequestParam(required=false) String altText,
                                           @RequestParam(required=false) Integer sortOrder)
            throws IOException, InterruptedException {
        return catalog.createImageFromTempKey(productId, key, altText, sortOrder);
    }

    // ─────────────────────────────── Options ────────────────────────────────

    /** Create an option for a product. */
    @PostMapping("/products/{productId}/options")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductOption createOption(@PathVariable Long productId, @Valid @RequestBody ProductOptionDto dto) {
        dto.setProductId(productId);
        return catalog.createProductOption(dto);
    }

    /** List options for a product (read: public). */
    @GetMapping("/products/{productId}/options")
    public List<ProductOption> listOptions(@PathVariable Long productId) {
        return catalog.listProductOptions(productId);
    }

    /** Get option by id (read: public). */
    @GetMapping("/options/{optionId}")
    public ProductOption getOption(@PathVariable Long optionId) {
        return catalog.getProductOption(optionId);
    }

    /** Update option. */
    @PutMapping("/options/{optionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ProductOption updateOption(@PathVariable Long optionId, @Valid @RequestBody ProductOptionDto dto) {
        dto.setId(optionId);
        return catalog.updateProductOption(dto);
    }

    /** Soft-delete option. */
    @DeleteMapping("/options/{optionId}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteOption(@PathVariable Long optionId) {
        catalog.deleteProductOption(optionId);
    }

    // ───────────────────────────── Option Values ─────────────────────────────

    /** Create a value for an option. */
    @PostMapping("/options/{optionId}/values")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductOptionValue createValue(@PathVariable Long optionId, @Valid @RequestBody ProductOptionValueDto dto) {
        dto.setOptionId(optionId);
        return catalog.createProductOptionValue(dto);
    }

    /** List values for an option (read: public). */
    @GetMapping("/options/{optionId}/values")
    public List<ProductOptionValue> listValues(@PathVariable Long optionId) {
        return catalog.listOptionValues(optionId);
    }

    /** Get value by id (read: public). */
    @GetMapping("/options/{optionId}/values/{valueId}")
    public ProductOptionValue getValue(@PathVariable Long optionId, @PathVariable Long valueId) {
        return catalog.getProductOptionValue(optionId, valueId);
    }

    /** Update value. */
    @PutMapping("/options/{optionId}/values/{valueId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ProductOptionValue updateValue(@PathVariable Long optionId,
                                          @PathVariable Long valueId,
                                          @Valid @RequestBody ProductOptionValueDto dto) {
        dto.setOptionId(optionId);
        dto.setId(valueId);
        return catalog.updateProductOptionValue(dto);
    }

    /** Soft-delete value. */
    @DeleteMapping("/options/{optionId}/values/{valueId}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteValue(@PathVariable Long optionId, @PathVariable Long valueId) {
        catalog.deleteProductOptionValue(optionId, valueId);
    }
    /** GET /api/catalog/products/featured?page=0&size=24 */
    @GetMapping("/products/featured")
    public CachedPage<ProductDto> listFeatured(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        return catalog.listFeaturedProductsDto(page, size);
    }



    /** GET /api/catalog/products/featured/top?limit=12 */
    @GetMapping("/products/featured/top")
    public List<ProductDto> listFeaturedTop(@RequestParam(defaultValue = "12") int limit) {
        return catalog.listFeaturedTopDto(limit);
    }

    // Mark featured = true
    @PostMapping("/products/{id}/featured")
    @PreAuthorize("hasRole('ADMIN')")
    public Product markFeatured(@PathVariable Long id) {
        return catalog.setProductFeatured(id, true);
    }

    // Mark featured = false
    @DeleteMapping("/products/{id}/featured")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unmarkFeatured(@PathVariable Long id) {
        catalog.setProductFeatured(id, false);
    }
}
