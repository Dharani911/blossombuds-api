package com.blossombuds.service;

import com.amazonaws.services.s3.model.*;
import com.blossombuds.domain.*;
import com.blossombuds.dto.*;
import com.blossombuds.repository.*;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

import com.blossombuds.util.ImageUtil;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;                  // ← added
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.URL;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;


import static com.blossombuds.util.ImageUtil.*;

import com.amazonaws.services.s3.AmazonS3;
import org.springframework.beans.factory.annotation.Value;

/** Catalog application service for categories, products, images, options, and values. */
@Slf4j
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogService {

    private final CategoryRepository categoryRepo;
    private final ProductRepository productRepo;
    private final ProductCategoryRepository linkRepo;
    private final ProductImageRepository imageRepo;
    private final ProductOptionRepository optionRepo;
    private final ProductOptionValueRepository valueRepo;

    private static final String CATEGORIES = "catalog.categories";
    private static final String PRODUCT_BY_ID = "catalog.productById";
    private static final String PRODUCTS_PAGE = "catalog.products.page";
    private static final String PRODUCTS_BY_CATEGORY = "catalog.products.byCategory";
    private static final String FEATURED_PAGE = "catalog.featured.page";
    private static final String FEATURED_TOP = "catalog.featured.top";
    private static final String NEW_ARRIVALS = "catalog.newArrivals";
    //private static final String PRODUCT_IMAGES = "catalog.productImages"; // keep TTL short if you cache

    private final AmazonS3 r2Client;
    @Value("${cloudflare.r2.bucket}")
    private String bucketName;

    @Value("${cloudflare.r2.endpoint}")
    private String r2Endpoint;


    private static final long MAX_BYTES = 10L * 1024 * 1024;
    static { javax.imageio.ImageIO.setUseCache(false); }
    private static BufferedImage WATERMARK_IMG = null;

    @PostConstruct
    public void initWatermark() {
        try (InputStream is = new ClassPathResource("watermark.png").getInputStream()) {
            WATERMARK_IMG = ImageIO.read(is);
            if (WATERMARK_IMG == null) {
                log.warn("watermark.png found but could not be decoded; watermarking will be skipped.");
            } else {
                log.info("Loaded watermark.png from classpath: {}x{}", WATERMARK_IMG.getWidth(), WATERMARK_IMG.getHeight());
            }
        } catch (Exception e) {
            log.warn("watermark.png not found on classpath; watermarking will be skipped.");
            WATERMARK_IMG = null;
        }
    }

    // ────────────────────────────── Categories ────────────────────────────────

    /** Creates a category from the given DTO. */
    @Caching(evict = {
            @CacheEvict(cacheNames = CATEGORIES, allEntries = true),
            @CacheEvict(cacheNames = {PRODUCTS_BY_CATEGORY, PRODUCTS_PAGE}, allEntries = true)
    })
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CategoryDto createCategory(CategoryDto dto) {
        if (dto == null) throw new IllegalArgumentException("CategoryDto is required");
        log.info("Creating new category: {}", dto.getName());
        if (dto.getName() == null || dto.getName().isBlank()) {
            log.warn("[CATEGORY][CREATE][FAIL] Missing name");
            throw new IllegalArgumentException("Category name is required");
        }

        Category c = new Category();
        c.setName(dto.getName().trim());
        c.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);

        // parent
        if (dto.getParentId() != null) {
            Category parent = categoryRepo.findById(dto.getParentId())
                    .orElseThrow(() -> {
                        log.warn("[CATEGORY][CREATE][FAIL] Parent not found: {}", dto.getParentId());
                        return new IllegalArgumentException("Parent category not found: " + dto.getParentId());
                    });
            c.setParent(parent);
        } else {
            c.setParent(null);
        }

        // slug
        String provided = dto.getSlug();
        if (provided != null && !provided.isBlank()) {
            String normalized = slugify(provided);
            if (categoryRepo.existsBySlug(normalized)) {
                log.warn("[CATEGORY][CREATE][FAIL] Duplicate slug '{}'", normalized);
                throw new DuplicateKeyException("Slug already exists: " + normalized);
            }
            c.setSlug(normalized);
        } else {
            String base = slugify(c.getName());
            String candidate = base;
            int i = 2;
            while (categoryRepo.existsBySlug(candidate)) candidate = base + "-" + i++;
            c.setSlug(candidate);
        }
        if (dto.getDescription()!=null){
            c.setDescription(dto.getDescription());
        }

        Category saved = categoryRepo.save(c);
        log.info("[CATEGORY][CREATE][OK] id={} slug='{}'", saved.getId(), saved.getSlug());
        return toDto(saved);
    }

    /** Naive slugify mirroring your frontend logic. */
    private static String slugify(String s) {
        String out = s.toLowerCase()
                .trim()
                .replaceAll("['\"]", "")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return out.isEmpty() ? "category" : out;
    }

    /** Lists all active categories. */
    public List<Category> listCategories() {
        log.info("[CATEGORY][LIST]");
        List<Category> all = categoryRepo.findAll();
        log.info("[CATEGORY][LIST][OK] count={}", all.size());
        return all;
    } // relies on @Where(active = true)


    /** Retrieves a category by id or throws if not found. */
    public Category getCategory(Long id) {
        log.info("[CATEGORY][GET] id={}", id);
        if (id == null) throw new IllegalArgumentException("Category id is required");
        Optional<Category> opt = categoryRepo.findById(id);
        if (opt.isEmpty()) {
            log.warn("[CATEGORY][GET][MISS] id={}", id);
            throw new IllegalArgumentException("Category not found: " + id);
        }
        return opt.get();
    }

    /** Updates a category’s mutable fields. */
    @Caching(evict = {
            @CacheEvict(cacheNames = CATEGORIES, allEntries = true),
            @CacheEvict(cacheNames = {PRODUCTS_BY_CATEGORY, PRODUCTS_PAGE}, allEntries = true)
    })
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CategoryDto updateCategory(Long id, CategoryDto dto) {
        log.info("[CATEGORY][UPDATE] id={} name='{}'", id, (dto!=null?dto.getName():null));
        if (id == null) throw new IllegalArgumentException("Category id is required");
        if (dto == null) throw new IllegalArgumentException("CategoryDto is required");

        Category c = getCategory(id);

        if (dto.getName() != null) {
            String name = dto.getName().trim();
            if (name.isEmpty()) {
                log.warn("[CATEGORY][UPDATE][FAIL] Blank name id={}", id);
                throw new IllegalArgumentException("Category name cannot be blank");
            } c.setName(name);
        }

        if (dto.getSlug() != null) {
            String normalized = slugify(dto.getSlug());
            if (!normalized.equalsIgnoreCase(c.getSlug())) {
                if (categoryRepo.existsBySlug(normalized) && !normalized.equalsIgnoreCase(c.getSlug())) {
                    log.warn("[CATEGORY][UPDATE][FAIL] Duplicate slug '{}' id={}", normalized, id);
                    throw new org.springframework.dao.DuplicateKeyException("Slug already exists: " + normalized);
                }
                c.setSlug(normalized);
            }
        }

        if (dto.getActive() != null) c.setActive(dto.getActive());

        if (dto.getParentId() != null) {
            Long parentId = dto.getParentId();
            if (parentId <= 0) {
                c.setParent(null);
            } else if (parentId.equals(id)) {
                log.warn("[CATEGORY][UPDATE][FAIL] Parent equals self id={}", id);
                throw new IllegalArgumentException("A category cannot be its own parent");
            } else {
                Category parent = categoryRepo.findById(parentId)
                        .orElseThrow(() -> {
                            log.warn("[CATEGORY][UPDATE][FAIL] Parent not found parentId={} id={}", parentId, id);
                            return new IllegalArgumentException("Parent category not found: " + parentId);
                        });
                if (wouldCreateCycle(c, parent)) {
                    log.warn("[CATEGORY][UPDATE][FAIL] Cycle detected id={} parentId={}", id, parentId);
                    throw new IllegalArgumentException("Invalid parent: would create a cycle in the category tree");
                }
                c.setParent(parent);
            }
        }
        if (dto.getDescription()!=null){
            c.setDescription(dto.getDescription());
        }

        log.info("[CATEGORY][UPDATE][OK] id={}", id);
        return toDto(c); // dirty checking
    }

    /** Walk up the chain to ensure 'parent' is not a descendant of 'node'. */
    private boolean wouldCreateCycle(Category node, Category parentCandidate) {
        Category cur = parentCandidate;
        while (cur != null) {
            if (cur.getId() != null && cur.getId().equals(node.getId())) return true;
            cur = cur.getParent();
        }
        return false;
    }

    /** Soft-deletes a category (active=false via @SQLDelete). */
    @Caching(evict = {
            @CacheEvict(cacheNames = CATEGORIES, allEntries = true),
            @CacheEvict(cacheNames = {PRODUCTS_BY_CATEGORY, PRODUCTS_PAGE}, allEntries = true)
    })
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteCategory(Long id) {
        log.info("[CATEGORY][DELETE] id={}", id);
        if (id == null) throw new IllegalArgumentException("Category id is required");
        categoryRepo.findById(id).ifPresent(category -> {
            categoryRepo.delete(category);
            log.info("[CATEGORY][DELETE][OK] id={}", id);
        });
    }

    // ─────────────────────────────── Products ────────────────────────────────

    /** Creates a product from the given DTO. */
    @Caching(evict = {
            @CacheEvict(cacheNames = {PRODUCTS_PAGE, PRODUCTS_BY_CATEGORY, FEATURED_PAGE, FEATURED_TOP, NEW_ARRIVALS}, allEntries = true),
            @CacheEvict(cacheNames = PRODUCT_BY_ID, allEntries = true)
    })
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductDto createProduct(ProductDto dto) {
        log.info("[PRODUCT][CREATE] name='{}' slug='{}'", (dto!=null?dto.getName():null), (dto!=null?dto.getSlug():null));
        if (dto == null) throw new IllegalArgumentException("ProductDto is required");
        Product p = new Product();
        // slug generation with uniqueness check
        String baseSlug = (dto.getSlug() != null && !dto.getSlug().isBlank())
                ? slugify(dto.getSlug())
                : slugify(dto.getName());

        String candidate = baseSlug;
        int i = 2;
        while (productRepo.existsBySlugNative(candidate)) {
            candidate = baseSlug + "-" + i++;
        }
        p.setSlug(candidate);
        p.setName(dto.getName());
        p.setDescription(dto.getDescription());
        p.setPrice(dto.getPrice());
        p.setVisible(dto.getVisible() != null ? dto.getVisible() : Boolean.TRUE);
        p.setFeatured(dto.getFeatured() != null ? dto.getFeatured() : Boolean.FALSE);
        p.setInStock(dto.getInStock() != null ? dto.getInStock() : Boolean.TRUE);
        p.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);
        Product saved = productRepo.save(p);
        log.info("[PRODUCT][CREATE][OK] id={} visible={} featured={}", saved.getId(), saved.getVisible(), saved.getFeatured());
        return toDto(saved);
    }

    /** Pages through active products. */
    public Page<Product> listProducts(int page, int size) {
        log.info("[PRODUCT][LIST] page={} size={}", page, size);
        Page<Product> pg = productRepo.findAll(PageRequest.of(page, size)); // relies on @Where(active = true)
        log.info("[PRODUCT][LIST][OK] page={} size={} returned={}", page, size, pg.getNumberOfElements());
        return pg; // relies on @Where(active = true)
    }

    /** Retrieves a product by id or throws if not found. */
    public Product getProduct(Long id) {
        log.info("[PRODUCT][GET] id={}", id);
        if (id == null) throw new IllegalArgumentException("Product id is required");
        Optional<Product> opt = productRepo.findById(id);
        if (opt.isEmpty()) {
            log.warn("[PRODUCT][GET][MISS] id={}", id);
            throw new IllegalArgumentException("Product not found: " + id);
        }
        return opt.get();
    }

    /** Updates a product’s mutable fields. */
    @Caching(evict = {
            @CacheEvict(cacheNames = PRODUCT_BY_ID, key = "'id=' + #id"),
            @CacheEvict(cacheNames = {PRODUCTS_PAGE, PRODUCTS_BY_CATEGORY, FEATURED_PAGE, FEATURED_TOP, NEW_ARRIVALS}, allEntries = true)
    })
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductDto updateProduct(Long id, ProductDto dto) {
        log.info("[PRODUCT][UPDATE] id={} name='{}'", id, (dto!=null?dto.getName():null));
        if (id == null) throw new IllegalArgumentException("Product id is required");
        if (dto == null) throw new IllegalArgumentException("ProductDto is required");
        Product p = getProduct(id);
        if (dto.getSlug() != null) {
            String normalized = slugify(dto.getSlug());
            if (!normalized.equalsIgnoreCase(p.getSlug())) {
                // check uniqueness if changing
                String candidate = normalized;
                int i = 2;
                while (productRepo.existsBySlugNative(candidate)) {
                    // if collision, check if it's NOT this product (though native query doesn't easily exclude self without ID param)
                    // For update, we want to allow keeping own slug, but here we are changing it.
                    // If candidate exists and it's NOT self, we must increment.
                    // Since native query is simple existence, we might collide with self if we don't exclude self.
                    // BUT, we are only entering here if normalized != p.getSlug().
                    // So we are changing to a NEW slug. If that new slug exists, it's a collision.
                    candidate = normalized + "-" + i++;
                }
                p.setSlug(candidate);
            }
        }
        if (dto.getName() != null) p.setName(dto.getName());
        if (dto.getDescription() != null) p.setDescription(dto.getDescription());
        if (dto.getPrice() != null) p.setPrice(dto.getPrice());
        if (dto.getVisible() != null)     p.setVisible(dto.getVisible());
        if (dto.getFeatured() != null)    p.setFeatured(dto.getFeatured());
        if (dto.getInStock() != null)    p.setInStock(dto.getInStock());
        if (dto.getActive() != null) p.setActive(dto.getActive());
        log.info("[PRODUCT][UPDATE][OK] id={}", id);
        return toDto(p); // dirty checking
    }

    /** Soft-deletes a product (active=false via @SQLDelete). */
    @Caching(evict = {
            @CacheEvict(cacheNames = PRODUCT_BY_ID, key = "'id=' + #id"),
            @CacheEvict(cacheNames = {PRODUCTS_PAGE, PRODUCTS_BY_CATEGORY, FEATURED_PAGE, FEATURED_TOP, NEW_ARRIVALS}, allEntries = true)
    })
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteProduct(Long id) {
        log.info("[PRODUCT][DELETE] id={}", id);
        if (id == null) throw new IllegalArgumentException("Product id is required");
        productRepo.findById(id).ifPresent(prod -> {
            productRepo.delete(prod);
            log.info("[PRODUCT][DELETE][OK] id={}", id);
        });
    }

    /** Pages active products belonging to a specific category. */
    public Page<Product> listProductsByCategory(Long categoryId, int page, int size) {
        log.info("[PRODUCT][LIST_BY_CATEGORY] categoryId={} page={} size={}", categoryId, page, size);
        if (categoryId == null) throw new IllegalArgumentException("categoryId is required");
        Page<Product> result = productRepo.findActiveByCategoryId(categoryId, PageRequest.of(page, size));
        log.info("[PRODUCT][LIST_BY_CATEGORY][OK] categoryId={} returned={}", categoryId, result.getNumberOfElements());
        return result;
    }

    /** Lists active categories linked to a product. */
    public List<Category> listCategoriesForProduct(Long productId) {
        log.info("[CATEGORY][LIST_FOR_PRODUCT] productId={}", productId);
        if (productId == null) throw new IllegalArgumentException("productId is required");
        List<Category> list = categoryRepo.findActiveByProductId(productId);
        log.info("[CATEGORY][LIST_FOR_PRODUCT][OK] productId={} count={}", productId, list.size());
        return list;
    }

    /** NEW: New Arrivals — newest products first (active=true via @Where). */
    public List<Product> listNewArrivals(int limit) {
        int lim = Math.max(1, Math.min(100, limit)); // sanity cap
        log.info("[PRODUCT][NEW_ARRIVALS] limit={}", lim);
        Page<Product> page = productRepo.findAll(
                PageRequest.of(0, lim, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        List<Product> out = page.getContent();
        log.info("[PRODUCT][NEW_ARRIVALS][OK] returned={}", out.size());
        return out;
    }

    // ─────────────────────── Product ↔ Category links ────────────────────────

    /** Links a product to a category (idempotent). */
    @Caching(evict = {
            @CacheEvict(cacheNames = PRODUCTS_BY_CATEGORY, allEntries = true),
            @CacheEvict(cacheNames = PRODUCTS_PAGE, allEntries = true),
            @CacheEvict(cacheNames = PRODUCT_BY_ID, allEntries = true)
    })

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void linkProductToCategory(Long productId, Long categoryId) {
        log.info("[LINK][PRODUCT_CATEGORY][CREATE] productId={} categoryId={}", productId, categoryId);
        if (productId == null || categoryId == null) {
            throw new IllegalArgumentException("productId and categoryId are required");
        }

        var existing = linkRepo.findAnyLink(productId, categoryId);

        if (existing.isPresent()) {
            ProductCategory link = existing.get();
            if (Boolean.FALSE.equals(link.getActive())) {
                link.setActive(true);
                log.info("[LINK][PRODUCT_CATEGORY][REACTIVATE] productId={} categoryId={}", productId, categoryId);
            } else {
                log.info("[LINK][PRODUCT_CATEGORY][NOOP] already active productId={} categoryId={}", productId, categoryId);
            }
            return;
        }

        ProductCategory link = new ProductCategory();
        link.setId(new ProductCategory.PK(productId, categoryId));
        link.setProduct(productRepo.getReferenceById(productId));
        link.setCategory(categoryRepo.getReferenceById(categoryId));
        link.setActive(Boolean.TRUE);
        linkRepo.save(link);
        log.info("[LINK][PRODUCT_CATEGORY][OK] productId={} categoryId={}", productId, categoryId);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = PRODUCTS_BY_CATEGORY, allEntries = true),
            @CacheEvict(cacheNames = PRODUCTS_PAGE, allEntries = true),
            @CacheEvict(cacheNames = PRODUCT_BY_ID, allEntries = true)
    })

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void unlinkProductFromCategory(Long productId, Long categoryId) {
        log.info("[LINK][PRODUCT_CATEGORY][DELETE] productId={} categoryId={}", productId, categoryId);
        if (productId == null || categoryId == null) {
            throw new IllegalArgumentException("productId and categoryId are required");
        }
        linkRepo.findAnyLink(productId, categoryId)
                .ifPresent(link -> {
                    link.setActive(false);
                    log.info("[LINK][PRODUCT_CATEGORY][DEACTIVATED] productId={} categoryId={}", productId, categoryId);
                });
    }

    // ───────────────────────────────── Images ────────────────────────────────

    private String uploadJpegBytes(byte[] bytes) throws IOException {
        String key = "products/" + UUID.randomUUID() + ".jpg";
        ObjectMetadata meta = new ObjectMetadata();
        meta.setContentType("image/jpeg");
        meta.setContentLength(bytes.length);
        try (InputStream in = new ByteArrayInputStream(bytes)) {
            r2Client.putObject(new PutObjectRequest(bucketName, key, in, meta));
        }
        return key;
    }

    // ───────────────── addProductImage (REPLACE) ─────────────────

    @CacheEvict(cacheNames = PRODUCT_BY_ID, key = "'id=' + #productId")
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductImage addProductImage(Long productId, MultipartFile file, String altText, Integer sortOrder)
            throws IOException {
        Instant t0 = Instant.now();

        log.info("[IMAGE][ADD] productId={} file='{}' type='{}' size={}",
                productId,
                file != null ? file.getOriginalFilename() : null,
                file != null ? file.getContentType() : null,
                file != null ? file.getSize() : -1);

        if (file == null || file.isEmpty()) {
            log.warn("[IMAGE][ADD][FAIL] Empty file: productId={}", productId);
            throw new IllegalArgumentException("File cannot be null or empty");
        }

        // Basic size/type validation (no HEIC now)
        validateFile(file);

        // 1) Decode using pure Java
        BufferedImage original;
        try (InputStream in = file.getInputStream()) {
            original = ImageIO.read(in);
        }
        if (original == null) {
            log.warn("[IMAGE][ADD][FAIL] Unsupported image after decode");
            throw new IllegalArgumentException("Uploaded file is not a supported image (JPG, PNG, WebP…).");
        }

        // 2) Resize to MAX_DIM
        BufferedImage resized = ImageUtil.fitWithin(original, ImageUtil.MAX_DIM);

        // 3) Apply watermark (logo if present, else text grid)
        BufferedImage stamped = watermarkLogoOrText(resized, WATERMARK_IMG, "BLOSSOM BUDS");

        // 4) Compress to JPEG using your existing helper
        byte[] finalBytes = ImageUtil.toJpegUnderCap(stamped);
        log.info("[IMAGE][ADD] final JPEG size={} bytes", finalBytes.length);

        // 5) Upload to R2
        String key = "products/" + UUID.randomUUID() + ".jpg";
        ObjectMetadata meta = new ObjectMetadata();
        meta.setContentType("image/jpeg");
        meta.setContentLength(finalBytes.length);

        try (InputStream in = new ByteArrayInputStream(finalBytes)) {
            r2Client.putObject(new PutObjectRequest(bucketName, key, in, meta));
        }

        String fileUrl = r2Endpoint + "/" + bucketName + "/" + key;
        log.info("[IMAGE][ADD][UPLOAD][OK] key={} bytes={}", key, finalBytes.length);

        // 6) Persist row
        ProductImage imgRow = new ProductImage();
        imgRow.setProduct(productRepo.getReferenceById(productId));
        imgRow.setPublicId(key);
        imgRow.setUrl(fileUrl);
        imgRow.setWatermarkVariantUrl(fileUrl);
        imgRow.setAltText(altText);
        imgRow.setSortOrder(sortOrder != null ? sortOrder : 0);
        imgRow.setActive(true);

        ProductImage saved = imageRepo.save(imgRow);
        log.info("[IMAGE][ADD][OK] id={} productId={} elapsedMs={}",
                saved.getId(), productId, Duration.between(t0, Instant.now()).toMillis());

        return saved;
    }


    // ──────────────── updateProductImage (REPLACE) ────────────────
    @CacheEvict(cacheNames = PRODUCT_BY_ID, key = "'id=' + #dto.productId")
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductImage updateProductImage(ProductImageDto dto, MultipartFile newFile)
            throws IOException {
        Instant t0 = Instant.now();
        log.info("[IMAGE][UPDATE] id={} productId={} replaceFile={}",
                (dto != null ? dto.getId() : null),
                (dto != null ? dto.getProductId() : null),
                (newFile != null && !newFile.isEmpty()));

        if (dto == null || dto.getId() == null || dto.getProductId() == null)
            throw new IllegalArgumentException("Image id and productId are required");

        ProductImage imgRow = imageRepo.findById(dto.getId())
                .orElseThrow(() -> {
                    log.warn("[IMAGE][UPDATE][MISS] id={}", dto.getId());
                    return new IllegalArgumentException("Image not found: " + dto.getId());
                });

        if (!imgRow.getProduct().getId().equals(dto.getProductId())) {
            log.warn("[IMAGE][UPDATE][FAIL] Image not under product imageId={} productId={}", dto.getId(), dto.getProductId());
            throw new IllegalArgumentException("Image does not belong to product " + dto.getProductId());
        }

        // Optional new file → process like addProductImage
        if (newFile != null && !newFile.isEmpty()) {
            validateFile(newFile);

            BufferedImage original;
            try (InputStream in = newFile.getInputStream()) {
                original = ImageIO.read(in);
            }
            if (original == null) {
                log.warn("[IMAGE][UPDATE][FAIL] Unsupported image after decode");
                throw new IllegalArgumentException("Uploaded file is not a supported image (JPG, PNG, WebP…).");
            }

            BufferedImage resized = ImageUtil.fitWithin(original, ImageUtil.MAX_DIM);
            BufferedImage stamped = watermarkLogoOrText(resized, WATERMARK_IMG, "BLOSSOM BUDS");
            byte[] finalBytes = ImageUtil.toJpegUnderCap(stamped);

            String key = "products/" + UUID.randomUUID() + ".jpg";
            ObjectMetadata meta = new ObjectMetadata();
            meta.setContentType("image/jpeg");
            meta.setContentLength(finalBytes.length);

            try (InputStream in = new ByteArrayInputStream(finalBytes)) {
                r2Client.putObject(new PutObjectRequest(bucketName, key, in, meta));
            }

            String url = r2Endpoint + "/" + bucketName + "/" + key;
            imgRow.setPublicId(key);
            imgRow.setUrl(url);
            imgRow.setWatermarkVariantUrl(url);
            log.info("[IMAGE][UPDATE][UPLOAD][OK] key='{}' bytes={}", key, finalBytes.length);
        }

        if (dto.getAltText() != null) imgRow.setAltText(dto.getAltText());
        if (dto.getSortOrder() != null) imgRow.setSortOrder(dto.getSortOrder());
        if (dto.getActive() != null) imgRow.setActive(dto.getActive());

        ProductImage saved = imageRepo.save(imgRow);
        log.info("[IMAGE][UPDATE][OK] id={} elapsedMs={}",
                saved.getId(), Duration.between(t0, Instant.now()).toMillis());
        return saved;
    }


    /**
     * Tiles your PNG logo (if present) diagonally with low opacity.
     * Falls back to subtle text grid when logo is null.
     */
    private static BufferedImage watermarkLogoOrText(BufferedImage src, BufferedImage logoOrNull, String fallbackText) {
        if (logoOrNull == null) {
            return watermarkSubtleGrid(src, fallbackText);
        }

        int w = src.getWidth(), h = src.getHeight();
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();

        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);

        g.drawImage(src, 0, 0, null);

        double angle = Math.toRadians(-22);
        AffineTransform oldTx = g.getTransform();
        g.translate(w / 2.0, h / 2.0);
        g.rotate(angle);

        int L = (int)Math.ceil(Math.hypot(w, h));

        double shortSide = Math.min(w, h);
        int target = (int)Math.round(shortSide * 0.12);
        double scale = Math.min(1.0,
                Math.max(0.25, target / (double)Math.max(1, Math.max(logoOrNull.getWidth(), logoOrNull.getHeight()))));

        int logoW = (int)Math.round(logoOrNull.getWidth() * scale);
        int logoH = (int)Math.round(logoOrNull.getHeight() * scale);

        int stepX = Math.max(logoW + (int)(shortSide * 0.06), logoW + 40);
        int stepY = Math.max(logoH + (int)(shortSide * 0.05), logoH + 34);

        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.08f));
        for (int y = -L; y <= L; y += stepY) {
            int xOffset = ((y / stepY) & 1) == 0 ? 0 : stepX / 2;
            for (int x = -L - stepX; x <= L + stepX; x += stepX) {
                g.drawImage(logoOrNull, x + xOffset + 1, y + 1, logoW, logoH, null);
            }
        }

        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.14f));
        for (int y = -L; y <= L; y += stepY) {
            int xOffset = ((y / stepY) & 1) == 0 ? 0 : stepX / 2;
            for (int x = -L - stepX; x <= L + stepX; x += stepX) {
                g.drawImage(logoOrNull, x + xOffset, y, logoW, logoH, null);
            }
        }

        g.setTransform(oldTx);
        g.dispose();
        return out;
    }

    // helper
    private static BufferedImage watermarkSubtleGrid(BufferedImage src, String text) {
        int w = src.getWidth(), h = src.getHeight();
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();

        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);

        g.drawImage(src, 0, 0, null);

        double angle = Math.toRadians(-22);
        AffineTransform oldTx = g.getTransform();
        g.translate(w / 2.0, h / 2.0);
        g.rotate(angle);

        int L = (int) Math.ceil(Math.hypot(w, h));

        float fontSize = Math.max(12f, Math.min(w, h) * 0.045f);
        Font font = new Font(Font.SANS_SERIF, Font.BOLD, Math.round(fontSize));
        g.setFont(font);
        FontMetrics fm = g.getFontMetrics();
        int textW = fm.stringWidth(text);
        int stepX = Math.max(60, textW + (int)(fontSize * 0.8));
        int stepY = Math.max(40, (int)(fontSize * 2.1));

        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.08f));
        g.setColor(Color.WHITE);
        for (int y = -L; y <= L; y += stepY) {
            int xOffset = ((y / stepY) & 1) == 0 ? 0 : stepX / 2;
            for (int x = -L - stepX; x <= L + stepX; x += stepX) {
                g.drawString(text, x + xOffset, y);
            }
        }

        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.14f));
        g.setColor(new Color(0, 0, 0));
        for (int y = -L; y <= L; y += stepY) {
            int xOffset = ((y / stepY) & 1) == 0 ? 0 : stepX / 2;
            for (int x = -L - stepX; x <= L + stepX; x += stepX) {
                g.drawString(text, x + xOffset + 1, y + 1);
            }
        }

        g.setTransform(oldTx);
        g.dispose();
        return out;
    }

    private static String guessContentType(String name, String fallback) {
        if (name == null) return fallback;
        String n = name.toLowerCase();
        if (n.endsWith(".heic") || n.endsWith(".heif")) return "image/heic";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".webp")) return "image/webp";
        if (n.endsWith(".tif") || n.endsWith(".tiff")) return "image/tiff";
        if (n.endsWith(".bmp")) return "image/bmp";
        if (n.endsWith(".gif")) return "image/gif";
        return fallback;
    }

    /*private byte[] convertAnyToJpegBytes(byte[] raw, String filename, String contentType) throws IOException {
        String ct = (contentType == null || contentType.isBlank())
                ? guessContentType(filename, "application/octet-stream")
                : contentType;

        try {
            return ImageMagickUtil.ensureJpeg(raw, filename, ct);
        } catch (Exception primaryFail) {
            if (MagickBridge.looksLikeHeic(ct, filename)) {
                try {
                    return MagickBridge.heicToJpeg(raw, magickCmd);
                } catch (Exception magickFail) {
                    log.error("[IMAGE][CONVERT][FAIL] HEIC conversion error: {}", magickFail.toString());
                    throw new IOException("Image conversion failed (HEIC). " + primaryFail.getMessage(), magickFail);
                }
            }
            log.error("[IMAGE][CONVERT][FAIL] {}", primaryFail.toString());
            throw new IOException("Image conversion failed. " + primaryFail.getMessage(), primaryFail);
        }
    }*/

    // --- 1) Presign a browser PUT to R2 (10 min)
    public PresignResponse presignPut(String filename, String contentType) {
        log.info("[IMAGE][PRESIGN_PUT] name='{}' type='{}'", filename, contentType);
        String safeName = (filename == null ? "file" : filename.replaceAll("[^A-Za-z0-9._-]", "_"));
        String key = "uploads/tmp/" + UUID.randomUUID() + "/" + safeName;
        Date exp = Date.from(Instant.now().plus(Duration.ofMinutes(10)));

        GeneratePresignedUrlRequest req = new GeneratePresignedUrlRequest(bucketName, key)
                .withMethod(com.amazonaws.HttpMethod.PUT)
                .withExpiration(exp);

        if (contentType != null && !contentType.isBlank()) {
            req.addRequestParameter("Content-Type", contentType);
        }

        URL url = r2Client.generatePresignedUrl(req);
        log.info("[IMAGE][PRESIGN_PUT][OK] key='{}'", key);
        return new PresignResponse(key, url.toString(), (contentType == null || contentType.isBlank())
                ? "application/octet-stream" : contentType);
    }

    // --- 2) Read temp object, process, upload final, delete temp, persist
    @CacheEvict(cacheNames = PRODUCT_BY_ID, key = "'id=' + #productId")
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductImageDto createImageFromTempKey(Long productId, String tempKey, String altText, Integer sortOrder)
            throws IOException, InterruptedException {
        log.info("[IMAGE][CREATE_FROM_TEMP] productId={} key='{}'", productId, tempKey);
        if (productId == null || tempKey == null || tempKey.isBlank())
            throw new IllegalArgumentException("productId and key are required");

        S3Object obj = r2Client.getObject(bucketName, tempKey);
        BufferedImage original;
        try (InputStream in = obj.getObjectContent()) {
            original = javax.imageio.ImageIO.read(in);
        }
        if (original == null) {log.warn("[IMAGE][CREATE_FROM_TEMP][FAIL] Unsupported image key='{}'", tempKey);
            throw new IllegalArgumentException("Uploaded file is not a supported image");
        }
        BufferedImage resized  = ImageUtil.fitWithin(original, ImageUtil.MAX_DIM);
        BufferedImage stamped  = applyTiledTextWatermark(resized, "BLOSSOM BUDS", 0.18f, -25.0, 0.045, 0.22);
        byte[] jpegBytes       = ImageUtil.toJpegUnderCap(stamped);

        String finalKey = "products/" + UUID.randomUUID() + ".jpg";
        ObjectMetadata meta = new ObjectMetadata();
        meta.setContentType("image/jpeg");
        meta.setContentLength(jpegBytes.length);
        try (InputStream up = new ByteArrayInputStream(jpegBytes)) {
            r2Client.putObject(new PutObjectRequest(bucketName, finalKey, up, meta));
        }

        try { r2Client.deleteObject(new DeleteObjectRequest(bucketName, tempKey)); } catch (Exception ignored) {
            log.warn("[IMAGE][CREATE_FROM_TEMP] Could not delete temp key='{}' (ignored)", tempKey);
        }
        ProductImage img = new ProductImage();
        img.setProduct(productRepo.getReferenceById(productId));
        img.setPublicId(finalKey);
        img.setUrl(null);
        img.setWatermarkVariantUrl(null);
        img.setAltText(altText);
        img.setSortOrder(sortOrder != null ? sortOrder : 0);
        img.setActive(true);

        ProductImage saved = imageRepo.save(img);
        return toResponse(saved);
    }

   /* private byte[] toJpegBytes(BufferedImage image, float quality) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageWriter jpgWriter = ImageIO.getImageWritersByFormatName("jpg").next();
        ImageWriteParam param = jpgWriter.getDefaultWriteParam();
        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(quality);

        try (ImageOutputStream ios = ImageIO.createImageOutputStream(baos)) {
            jpgWriter.setOutput(ios);
            jpgWriter.write(null, new IIOImage(image, null, null), param);
        } finally {
            jpgWriter.dispose();
        }
        return baos.toByteArray();
    }*/

    /** Draw a diagonal tiled text watermark onto an RGB copy and return it. */
    private BufferedImage applyTiledTextWatermark(
            BufferedImage src,
            String text,
            float alpha,
            double angleDeg,
            double fontScale,
            double gapFactor
    ) {
        int w = src.getWidth(), h = src.getHeight();
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        g.drawImage(src, 0, 0, null);

        int fontSize = Math.max(16, (int)Math.round(w * fontScale));
        Font font = new Font("SansSerif", Font.BOLD, fontSize);
        g.setFont(font);

        double theta = Math.toRadians(angleDeg);
        g.rotate(theta, w / 2.0, h / 2.0);

        FontMetrics fm = g.getFontMetrics();
        int textW = Math.max(1, fm.stringWidth(text));
        int textH = Math.max(1, fm.getAscent());

        int stepX = (int)Math.round(textW * (1.0 + gapFactor));
        int stepY = (int)Math.round(textH * (1.6 + gapFactor));

        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, Math.min(alpha * 0.45f, 0.08f)));

        float strokePx = Math.max(1f, fontSize * 0.009f);
        g.setStroke(new BasicStroke(strokePx, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));

        Color shadow = new Color(0, 0, 0, 220);
        Color outlineLight = new Color(255, 255, 255, 235);
        Color fillDark = new Color(0, 0, 0, 235);

        int startX = -w * 2, endX = w * 2;
        int startY = -h * 2, endY = h * 2;

        for (int y = startY; y < endY; y += stepY) {
            int rowOffset = ((y / stepY) % 2 == 0) ? 0 : (stepX / 2);
            for (int x = startX; x < endX; x += stepX) {
                int dx = x + rowOffset;
                int dy = y;

                g.setColor(shadow);
                g.drawString(text, dx + Math.max(2, fontSize / 16), dy + Math.max(2, fontSize / 16));
                g.fillRect(0,0,0,0);

                g.setColor(outlineLight);
                g.drawString(text, dx, dy);

                g.setColor(fillDark);
                g.drawString(text, dx, dy);
            }
        }

        g.dispose();
        return out;
    }

    private String signGetUrl(String key, java.time.Duration ttl) {
        Date exp = Date.from(Instant.now().plus(ttl));
        GeneratePresignedUrlRequest req = new GeneratePresignedUrlRequest(bucketName, key)
                .withMethod(com.amazonaws.HttpMethod.GET)
                .withExpiration(exp);
        URL url = r2Client.generatePresignedUrl(req);
        return url.toString();
    }

    public List<ProductImageDto> listProductImageResponses(Long productId) {
        if (productId == null) throw new IllegalArgumentException("productId is required");
        List<ProductImageDto> out = imageRepo.findByProduct_IdOrderBySortOrderAscIdAsc(productId)
                .stream()
                .map(this::toResponse)
                .toList();
        log.info("[IMAGE][LIST_RESP][OK] productId={} count={}", productId, out.size());
        return out;
    }

    public ProductImageDto toResponse(ProductImage img) {
        String key = img.getPublicId();
        String signed = (key != null) ? signGetUrl(key, java.time.Duration.ofMinutes(30)) : null;

        ProductImageDto r = new ProductImageDto();
        r.setId(img.getId());
        r.setProductId(img.getProduct().getId());
        r.setPublicId(key);
        r.setUrl(signed);
        r.setWatermarkVariantUrl(signed);
        r.setAltText(img.getAltText());
        r.setSortOrder(img.getSortOrder());
        r.setActive(img.getActive());
        return r;
    }

    /** Soft-deletes a product image (active=false via @SQLDelete). */
    @CacheEvict(cacheNames = PRODUCT_BY_ID, key = "'id=' + #productId")
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteProductImage(Long productId, Long imageId) {
        log.info("[IMAGE][DELETE] productId={} imageId={}", productId, imageId);
        if (productId == null || imageId == null)
            throw new IllegalArgumentException("productId and imageId are required");

        imageRepo.findById(imageId).ifPresent(img -> {
            if (!img.getProduct().getId().equals(productId))
                throw new IllegalArgumentException("Image does not belong to product " + productId);

            if (img.getPublicId() != null) {
                try {
                    r2Client.deleteObject(new DeleteObjectRequest(bucketName, img.getPublicId()));
                    log.info("[IMAGE][DELETE][R2][OK] key='{}'", img.getPublicId());
                } catch (Exception e) {
                    log.warn("[IMAGE][DELETE][R2][WARN] key='{}' err={}", img.getPublicId(), e.toString());
                }
            }
            imageRepo.delete(img);
            log.info("[IMAGE][DELETE][OK] imageId={}", imageId);
        });
    }

    /** Makes an image primary (sortOrder=0) and pushes others down. */
    @CacheEvict(cacheNames = PRODUCT_BY_ID, key = "'id=' + #productId")
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void setPrimaryImage(Long productId, Long imageId) {
        log.info("[IMAGE][SET_PRIMARY] productId={} imageId={}", productId, imageId);
        if (productId == null || imageId == null) {
            throw new IllegalArgumentException("productId and imageId are required");
        }
        List<ProductImage> all = imageRepo.findByProduct_IdOrderBySortOrderAscIdAsc(productId);
        int next = 1;
        for (ProductImage img : all) {
            if (img.getId().equals(imageId)) {
                img.setSortOrder(0);
            } else {
                img.setSortOrder(next++);
            }
        }
        log.info("[IMAGE][SET_PRIMARY][OK] productId={} imageId={}", productId, imageId);
    }

    // ─────────────────────────────── Options ────────────────────────────────

    /** Creates an option for a product. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductOption createProductOption(ProductOptionDto dto) {
        log.info("[OPTION][CREATE] productId={} name='{}'", (dto!=null?dto.getProductId():null), (dto!=null?dto.getName():null));
        if (dto == null || dto.getProductId() == null) {
            throw new IllegalArgumentException("ProductOptionDto with productId is required");
        }
        ProductOption opt = new ProductOption();
        opt.setProduct(productRepo.getReferenceById(dto.getProductId()));
        opt.setName(dto.getName());
        opt.setInputType(dto.getInputType());
        opt.setRequired(dto.getRequired() != null ? dto.getRequired() : Boolean.TRUE);
        opt.setMaxSelect(dto.getMaxSelect());
        opt.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        opt.setVisible(dto.getVisible() != null ? dto.getVisible() : Boolean.TRUE);
        opt.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);
        ProductOption saved = optionRepo.save(opt);
        log.info("[OPTION][CREATE][OK] id={} productId={}", saved.getId(), dto.getProductId());
        return saved;
    }

    /** Lists options for a product ordered by sort order then id. */
    public List<ProductOption> listProductOptions(Long productId) {
        log.info("[OPTION][LIST] productId={}", productId);
        if (productId == null) throw new IllegalArgumentException("productId is required");
        List<ProductOption> list = optionRepo.findByProduct_IdOrderBySortOrderAscIdAsc(productId);
        log.info("[OPTION][LIST][OK] productId={} count={}", productId, list.size());
        return list;
    }

    /** Retrieves an option by id or throws if not found. */
    public ProductOption getProductOption(Long optionId) {
        log.info("[OPTION][GET] id={}", optionId);
        if (optionId == null) throw new IllegalArgumentException("optionId is required");
        Optional<ProductOption> opt = optionRepo.findById(optionId);
        if (opt.isEmpty()) {
            log.warn("[OPTION][GET][MISS] id={}", optionId);
            throw new IllegalArgumentException("Option not found: " + optionId);
        }
        return opt.get();
    }

    /** Updates an option’s mutable fields. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductOption updateProductOption(ProductOptionDto dto) {
        log.info("[OPTION][UPDATE] id={} name='{}'", (dto!=null?dto.getId():null), (dto!=null?dto.getName():null));
        if (dto == null || dto.getId() == null) {
            throw new IllegalArgumentException("ProductOptionDto with id is required");
        }
        ProductOption opt = getProductOption(dto.getId());
        if (dto.getName() != null) opt.setName(dto.getName());
        if (dto.getInputType() != null) opt.setInputType(dto.getInputType());
        if (dto.getRequired() != null) opt.setRequired(dto.getRequired());
        if (dto.getMaxSelect() != null) opt.setMaxSelect(dto.getMaxSelect());
        if (dto.getSortOrder() != null) opt.setSortOrder(dto.getSortOrder());
        if (dto.getVisible() != null) opt.setVisible(dto.getVisible());
        if (dto.getActive() != null) opt.setActive(dto.getActive());
        log.info("[OPTION][UPDATE][OK] id={}", dto.getId());
        return opt;
    }

    /** Soft-deletes a product option (active=false via @SQLDelete). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteProductOption(Long optionId) {
        log.info("[OPTION][DELETE] id={}", optionId);
        if (optionId == null) throw new IllegalArgumentException("optionId is required");
        optionRepo.findById(optionId).ifPresent(o -> {
            optionRepo.delete(o);
            log.info("[OPTION][DELETE][OK] id={}", optionId);
        });
    }

    // ───────────────────────────── Option Values ─────────────────────────────

    /** Creates a value under an option. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductOptionValue createProductOptionValue(ProductOptionValueDto dto) {
        log.info("[VALUE][CREATE] optionId={} code='{}' label='{}'", (dto!=null?dto.getOptionId():null), (dto!=null?dto.getValueCode():null), (dto!=null?dto.getValueLabel():null));
        if (dto == null || dto.getOptionId() == null) {
            throw new IllegalArgumentException("ProductOptionValueDto with optionId is required");
        }
        ProductOptionValue val = new ProductOptionValue();
        val.setOption(optionRepo.getReferenceById(dto.getOptionId()));
        val.setValueCode(dto.getValueCode());
        val.setValueLabel(dto.getValueLabel());
        val.setPriceDelta(dto.getPriceDelta());
        val.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        val.setVisible(dto.getVisible() != null ? dto.getVisible() : Boolean.TRUE);
        val.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);
        ProductOptionValue saved = valueRepo.save(val);
        log.info("[VALUE][CREATE][OK] id={} optionId={}", saved.getId(), dto.getOptionId());
        return saved;
    }

    /** Lists values for an option ordered by sort order then id. */
    public List<ProductOptionValue> listOptionValues(Long optionId) {
        log.info("[VALUE][LIST] optionId={}", optionId);
        if (optionId == null) throw new IllegalArgumentException("optionId is required");
        List<ProductOptionValue> list = valueRepo.findByOption_IdOrderBySortOrderAscIdAsc(optionId);
        log.info("[VALUE][LIST][OK] optionId={} count={}", optionId, list.size());
        return list;
    }

    /** Retrieves an option value by id scoped to its option or throws. */
    public ProductOptionValue getProductOptionValue(Long optionId, Long valueId) {
        log.info("[VALUE][GET] optionId={} valueId={}", optionId, valueId);
        if (optionId == null || valueId == null) {
            throw new IllegalArgumentException("optionId and valueId are required");
        }
        ProductOptionValue v = valueRepo.findById(valueId)
                .orElseThrow(() -> {
                    log.warn("[VALUE][GET][MISS] valueId={}", valueId);
                    return new IllegalArgumentException("Option value not found: " + valueId);
                });
        if (!v.getOption().getId().equals(optionId)) {
            log.warn("[VALUE][GET][FAIL] Mismatch optionId={} actualOptionId={}", optionId, v.getOption().getId());
            throw new IllegalArgumentException("Value does not belong to option " + optionId);
        }
        return v;
    }

    /** Updates an option value’s mutable fields. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductOptionValue updateProductOptionValue(ProductOptionValueDto dto) {
        log.info("[VALUE][UPDATE] id={} optionId={}", (dto!=null?dto.getId():null), (dto!=null?dto.getOptionId():null));
        if (dto == null || dto.getId() == null || dto.getOptionId() == null) {
            throw new IllegalArgumentException("ProductOptionValueDto with id and optionId is required");
        }
        ProductOptionValue v = getProductOptionValue(dto.getOptionId(), dto.getId());
        if (dto.getValueCode() != null) v.setValueCode(dto.getValueCode());
        if (dto.getValueLabel() != null) v.setValueLabel(dto.getValueLabel());
        if (dto.getPriceDelta() != null) v.setPriceDelta(dto.getPriceDelta());
        if (dto.getSortOrder() != null) v.setSortOrder(dto.getSortOrder());
        if (dto.getVisible() != null) v.setVisible(dto.getVisible());
        if (dto.getActive() != null) v.setActive(dto.getActive());
        log.info("[VALUE][UPDATE][OK] id={} optionId={}", dto.getId(), dto.getOptionId());
        return v;
    }

    /** Soft-deletes an option value (active=false via @SQLDelete). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteProductOptionValue(Long optionId, Long valueId) {
        log.info("[VALUE][DELETE] optionId={} valueId={}", optionId, valueId);
        if (optionId == null || valueId == null) {
            throw new IllegalArgumentException("optionId and valueId are required");
        }
        ProductOptionValue v = getProductOptionValue(optionId, valueId);
        valueRepo.delete(v);
        log.info("[VALUE][DELETE][OK] optionId={} valueId={}", optionId, valueId);
    }

    // at the bottom of CatalogService, replace your current validateFile(...) with this:
    public void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            log.warn("[FILE][VALIDATE][FAIL] Empty");
            throw new IllegalArgumentException("File cannot be empty");
        }
        if (file.getSize() > MAX_BYTES) {
            log.warn("[FILE][VALIDATE][FAIL] Too large size={} max={}", file.getSize(), MAX_BYTES);
            throw new IllegalArgumentException("Max 10 MB per image");
        }

        String name = (file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase());
        String ct   = (file.getContentType() == null ? "" : file.getContentType().toLowerCase());

        boolean extOk =
                name.endsWith(".jpg")  || name.endsWith(".jpeg") ||
                        name.endsWith(".png")  || name.endsWith(".webp") ||
                        name.endsWith(".gif")  || name.endsWith(".bmp")  ||
                        name.endsWith(".tif")  || name.endsWith(".tiff");

        boolean typeOk = ct.startsWith("image/") && extOk;

        if (!typeOk) {
            log.warn("[FILE][VALIDATE][FAIL] Not an image or unsupported type ct='{}' name='{}'", ct, name);
            throw new IllegalArgumentException("Only JPG, PNG, WebP, GIF, BMP, TIFF images are supported (no HEIC).");
        }
        log.debug("[FILE][VALIDATE][OK] name='{}' ct='{}' size={}", name, ct, file.getSize());
    }

    // ───────────────────── Featured Products ─────────────────────

    /** Page only featured (active=true via @Where). */
    public Page<Product> listFeaturedProducts(int page, int size) {
        log.info("[PRODUCT][FEATURED][LIST] page={} size={}", page, size);
        Page<Product> out = productRepo.findByFeaturedTrue(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        log.info("[PRODUCT][FEATURED][LIST][OK] returned={}", out.getNumberOfElements());
        return out;


        //        PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
    }

    /** Top-N featured (newest first). */
    public List<Product> listFeaturedTop(int limit) {
        int lim = Math.max(1, Math.min(100, limit));
        log.info("[PRODUCT][FEATURED][TOP] limit={}", lim);
        List<Product> out = productRepo.findByFeaturedTrue(
                PageRequest.of(0, lim, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();
        log.info("[PRODUCT][FEATURED][TOP][OK] returned={}", out.size());

        // Visible-gated variant:
        // return productRepo.findByFeaturedTrueAndVisibleTrue(
        //        PageRequest.of(0, lim, Sort.by(Sort.Direction.DESC, "createdAt"))
        // ).getContent();
        return out;
    }
    @Caching(evict = {
            @CacheEvict(cacheNames = PRODUCT_BY_ID, key = "'id=' + #id"),
            @CacheEvict(cacheNames = {FEATURED_PAGE, FEATURED_TOP, PRODUCTS_PAGE, NEW_ARRIVALS, PRODUCTS_BY_CATEGORY}, allEntries = true)
    })
    @Transactional
    public Product setProductFeatured(Long id, boolean featured) {
        log.info("[PRODUCT][FEATURED][SET] id={} featured={}", id, featured);
        Product p = getProduct(id);
        p.setFeatured(featured);
        log.info("[PRODUCT][FEATURED][SET][OK] id={} featured={}", id, featured);
        return p; // dirty checking persists
    }
    /** Maps a Product entity to a cache-safe DTO. */
    private ProductDto toDto(Product p) {
        ProductDto d = new ProductDto();
        d.setId(p.getId());
        d.setSlug(p.getSlug());
        d.setName(p.getName());
        d.setDescription(p.getDescription());
        d.setPrice(p.getPrice());
        d.setVisible(p.getVisible());
        d.setFeatured(p.getFeatured());
        d.setInStock(p.getInStock());
        d.setActive(p.getActive());
        return d;
    }

    /** Maps a Category entity to a cache-safe DTO. */
    private CategoryDto toDto(Category c) {
        CategoryDto d = new CategoryDto();
        d.setId(c.getId());
        d.setName(c.getName());
        d.setSlug(c.getSlug());
        d.setActive(c.getActive());
        d.setDescription(c.getDescription());
        d.setParentId(c.getParent() != null ? c.getParent().getId() : null);
        return d;
    }
    @Cacheable(cacheNames = CATEGORIES, key = "'all'")
    public List<CategoryDto> listCategoriesDto() {
        return categoryRepo.findAll()
                .stream()
                .map(this::toDto)
                .toList();
    }
    @Cacheable(cacheNames = PRODUCT_BY_ID, key = "'id=' + #id")
    public ProductDto getProductDto(Long id) {
        return toDto(getProduct(id));
    }


    @Cacheable(cacheNames = PRODUCTS_PAGE, key = "'p=' + #page + ':s=' + #size + ':sort=' + #sort + ':dir=' + #dir")
    public CachedPage<ProductDto> listProductsDto(int page, int size, String sort, String dir) {

        Sort s = Sort.by("createdAt");
        if (sort != null && !sort.isBlank()) s = Sort.by(sort);
        s = "ASC".equalsIgnoreCase(dir) ? s.ascending() : s.descending();

        Page<ProductDto> pg = productRepo.findAll(PageRequest.of(page, size, s)).map(this::toDto);

        return CachedPage.from(pg); // implement a small helper: content, page, size, total, totalPages, etc.
    }

    /** Ensures the product is purchasable before adding to cart / creating order. */
    private void assertInStock(Product p) {
        if (p == null) throw new IllegalArgumentException("Product is required");
        if (Boolean.FALSE.equals(p.getInStock())) {
            throw new IllegalArgumentException("Product is out of stock");
        }
    }

    @Cacheable(cacheNames = PRODUCTS_BY_CATEGORY, key = "'cat=' + #categoryId + ':p=' + #page + ':s=' + #size")
    public CachedPage<ProductDto> listProductsByCategoryDto(Long categoryId, int page, int size) {
        Page<ProductDto> pg = productRepo.findActiveByCategoryId(categoryId, PageRequest.of(page, size))
                .map(this::toDto);
        return CachedPage.from(pg);
    }

    @Cacheable(cacheNames = FEATURED_PAGE, key = "'p=' + #page + ':s=' + #size")
    public CachedPage<ProductDto> listFeaturedProductsDto(int page, int size) {
        Page<ProductDto> pg = productRepo.findByFeaturedTrue(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(this::toDto);
        return CachedPage.from(pg);
    }


    @Cacheable(cacheNames = FEATURED_TOP, key = "'lim=' + #limit")
    public List<ProductDto> listFeaturedTopDto(int limit) {
        int lim = Math.max(1, Math.min(100, limit));
        return productRepo.findByFeaturedTrue(PageRequest.of(0, lim, Sort.by(Sort.Direction.DESC, "createdAt")))
                .getContent()
                .stream()
                .map(this::toDto)
                .toList();
    }
    @Cacheable(cacheNames = NEW_ARRIVALS, key = "'lim=' + #limit")
    public List<ProductDto> listNewArrivalsDto(int limit) {
        return listNewArrivals(limit).stream().map(this::toDto).toList();
    }

    @Cacheable(cacheNames = CATEGORIES, key = "'id=' + #id")
    public CategoryDto getCategoryDto(Long id) {
        return toDto(getCategory(id));
    }

}
