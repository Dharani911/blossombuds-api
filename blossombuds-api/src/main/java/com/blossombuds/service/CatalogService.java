package com.blossombuds.service;

import com.amazonaws.services.s3.model.*;
import com.blossombuds.domain.*;
import com.blossombuds.dto.*;
import com.blossombuds.repository.*;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import com.blossombuds.util.ImageMagickUtil;
import com.blossombuds.util.ImageUtil;
import com.blossombuds.util.MagickBridge;
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
import java.util.UUID;

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

    @Value("${app.imagemagick.cmd}")
    private String magickCmd;

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
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Category createCategory(CategoryDto dto) {
        if (dto == null) throw new IllegalArgumentException("CategoryDto is required");
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new IllegalArgumentException("Category name is required");
        }

        Category c = new Category();
        c.setName(dto.getName().trim());
        c.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);

        // parent
        if (dto.getParentId() != null) {
            Category parent = categoryRepo.findById(dto.getParentId())
                    .orElseThrow(() -> new IllegalArgumentException("Parent category not found: " + dto.getParentId()));
            c.setParent(parent);
        } else {
            c.setParent(null);
        }

        // slug
        String provided = dto.getSlug();
        if (provided != null && !provided.isBlank()) {
            String normalized = slugify(provided);
            if (categoryRepo.existsBySlug(normalized)) {
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

        return categoryRepo.save(c);
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
        return categoryRepo.findAll(); // relies on @Where(active = true)
    }

    /** Retrieves a category by id or throws if not found. */
    public Category getCategory(Long id) {
        if (id == null) throw new IllegalArgumentException("Category id is required");
        return categoryRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Category not found: " + id));
    }

    /** Updates a category’s mutable fields. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Category updateCategory(Long id, CategoryDto dto) {
        if (id == null) throw new IllegalArgumentException("Category id is required");
        if (dto == null) throw new IllegalArgumentException("CategoryDto is required");

        Category c = getCategory(id);

        if (dto.getName() != null) {
            String name = dto.getName().trim();
            if (name.isEmpty()) throw new IllegalArgumentException("Category name cannot be blank");
            c.setName(name);
        }

        if (dto.getSlug() != null) {
            String normalized = slugify(dto.getSlug());
            if (!normalized.equalsIgnoreCase(c.getSlug())) {
                if (categoryRepo.existsBySlug(normalized) && !normalized.equalsIgnoreCase(c.getSlug())) {
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
                throw new IllegalArgumentException("A category cannot be its own parent");
            } else {
                Category parent = categoryRepo.findById(parentId)
                        .orElseThrow(() -> new IllegalArgumentException("Parent category not found: " + parentId));
                if (wouldCreateCycle(c, parent)) {
                    throw new IllegalArgumentException("Invalid parent: would create a cycle in the category tree");
                }
                c.setParent(parent);
            }
        }

        return c; // dirty checking
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
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteCategory(Long id) {
        if (id == null) throw new IllegalArgumentException("Category id is required");
        categoryRepo.findById(id).ifPresent(categoryRepo::delete);
    }

    // ─────────────────────────────── Products ────────────────────────────────

    /** Creates a product from the given DTO. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Product createProduct(ProductDto dto) {
        if (dto == null) throw new IllegalArgumentException("ProductDto is required");
        Product p = new Product();
        p.setSlug(dto.getSlug());
        p.setName(dto.getName());
        p.setDescription(dto.getDescription());
        p.setPrice(dto.getPrice());
        p.setVisible(dto.getVisible() != null ? dto.getVisible() : Boolean.TRUE);
        p.setFeatured(dto.getFeatured() != null ? dto.getFeatured() : Boolean.FALSE);

        p.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);
        return productRepo.save(p);
    }

    /** Pages through active products. */
    public Page<Product> listProducts(int page, int size) {
        return productRepo.findAll(PageRequest.of(page, size)); // relies on @Where(active = true)
    }

    /** Retrieves a product by id or throws if not found. */
    public Product getProduct(Long id) {
        if (id == null) throw new IllegalArgumentException("Product id is required");
        return productRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));
    }

    /** Updates a product’s mutable fields. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Product updateProduct(Long id, ProductDto dto) {
        if (id == null) throw new IllegalArgumentException("Product id is required");
        if (dto == null) throw new IllegalArgumentException("ProductDto is required");
        Product p = getProduct(id);
        if (dto.getSlug() != null) p.setSlug(dto.getSlug());
        if (dto.getName() != null) p.setName(dto.getName());
        if (dto.getDescription() != null) p.setDescription(dto.getDescription());
        if (dto.getPrice() != null) p.setPrice(dto.getPrice());
        if (dto.getVisible() != null)     p.setVisible(dto.getVisible());
        if (dto.getFeatured() != null)    p.setFeatured(dto.getFeatured());
        if (dto.getActive() != null) p.setActive(dto.getActive());
        return p; // dirty checking
    }

    /** Soft-deletes a product (active=false via @SQLDelete). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteProduct(Long id) {
        if (id == null) throw new IllegalArgumentException("Product id is required");
        productRepo.findById(id).ifPresent(productRepo::delete);
    }

    /** Pages active products belonging to a specific category. */
    public Page<Product> listProductsByCategory(Long categoryId, int page, int size) {
        if (categoryId == null) throw new IllegalArgumentException("categoryId is required");
        return productRepo.findActiveByCategoryId(categoryId, PageRequest.of(page, size));
    }

    /** Lists active categories linked to a product. */
    public List<Category> listCategoriesForProduct(Long productId) {
        if (productId == null) throw new IllegalArgumentException("productId is required");
        return categoryRepo.findActiveByProductId(productId);
    }

    /** NEW: New Arrivals — newest products first (active=true via @Where). */
    public List<Product> listNewArrivals(int limit) {
        int lim = Math.max(1, Math.min(100, limit)); // sanity cap
        Page<Product> page = productRepo.findAll(
                PageRequest.of(0, lim, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        return page.getContent();
    }

    // ─────────────────────── Product ↔ Category links ────────────────────────

    /** Links a product to a category (idempotent). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void linkProductToCategory(Long productId, Long categoryId) {
        if (productId == null || categoryId == null) {
            throw new IllegalArgumentException("productId and categoryId are required");
        }

        var existing = linkRepo.findAnyLink(productId, categoryId);

        if (existing.isPresent()) {
            ProductCategory link = existing.get();
            if (Boolean.FALSE.equals(link.getActive())) {
                link.setActive(true);
            }
            return;
        }

        ProductCategory link = new ProductCategory();
        link.setId(new ProductCategory.PK(productId, categoryId));
        link.setProduct(productRepo.getReferenceById(productId));
        link.setCategory(categoryRepo.getReferenceById(categoryId));
        link.setActive(Boolean.TRUE);
        linkRepo.save(link);
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void unlinkProductFromCategory(Long productId, Long categoryId) {
        if (productId == null || categoryId == null) {
            throw new IllegalArgumentException("productId and categoryId are required");
        }
        linkRepo.findAnyLink(productId, categoryId)
                .ifPresent(link -> link.setActive(false));
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
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductImage addProductImage(Long productId, MultipartFile file, String altText, Integer sortOrder)
            throws IOException, InterruptedException {

        log.info("addProductImage(productId={}, fileName='{}', contentType='{}', size={})",
                productId,
                (file != null ? file.getOriginalFilename() : "<null>"),
                (file != null ? file.getContentType() : "<null>"),
                (file != null ? file.getSize() : -1));

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File cannot be null or empty");
        }

        // Accept HEIC sent as octet-stream if extension looks like an image
        try {
            validateFile(file); // ← use the defined validator
        } catch (IllegalArgumentException iae) {
            String ct = file.getContentType() == null ? "" : file.getContentType();
            String fn = (file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase());
            boolean extOk = fn.endsWith(".heic") || fn.endsWith(".heif") || fn.endsWith(".jpg") || fn.endsWith(".jpeg")
                    || fn.endsWith(".png") || fn.endsWith(".webp") || fn.endsWith(".tif") || fn.endsWith(".tiff")
                    || fn.endsWith(".bmp") || fn.endsWith(".gif");
            if (!"application/octet-stream".equalsIgnoreCase(ct) || !extOk) throw iae;
            log.info("Proceeding with octet-stream file due to image-like extension.");
        }

        // 1) Normalize to JPEG (HEIC-safe)
        byte[] normalizedJpeg;
        try {
            normalizedJpeg = ImageMagickUtil.ensureJpeg(file.getBytes(), file.getOriginalFilename(), file.getContentType());
            log.info("Normalized via ensureJpeg -> {} bytes", normalizedJpeg.length);
        } catch (Exception e) {
            if (MagickBridge.looksLikeHeic(file.getContentType(), file.getOriginalFilename())) {
                normalizedJpeg = MagickBridge.heicToJpeg(file.getBytes(), magickCmd);
                log.info("Normalized via heicToJpeg -> {} bytes", normalizedJpeg.length);
            } else {
                throw new IOException("Image conversion failed: " + e.getMessage(), e);
            }
        }

        // 2) Decode → resize → watermark
        BufferedImage decoded = ImageMagickUtil.readImage(normalizedJpeg);
        if (decoded == null) throw new IllegalArgumentException("Uploaded file is not a supported image");
        BufferedImage base = ImageUtil.fitWithin(decoded, ImageUtil.MAX_DIM);

        BufferedImage stamped = watermarkLogoOrText(base, WATERMARK_IMG, "BLOSSOM BUDS");

        // 3) Compress
        byte[] finalBytes;
        try {
            finalBytes = ImageMagickUtil.targetSizeJpeg(stamped);
            if (finalBytes.length >= normalizedJpeg.length) {
                finalBytes = toJpegBytes(stamped, 0.82f);
            }
        } catch (Exception ce) {
            log.warn("Compression failed ({}). Using Java JPEG encoder fallback.", ce.toString());
            finalBytes = toJpegBytes(stamped, 0.82f);
        }

        // 4) Upload to R2
        String key = "products/" + UUID.randomUUID() + ".jpg";
        ObjectMetadata meta = new ObjectMetadata();
        meta.setContentType("image/jpeg");
        meta.setContentLength(finalBytes.length);
        try (InputStream in = new ByteArrayInputStream(finalBytes)) {
            r2Client.putObject(new PutObjectRequest(bucketName, key, in, meta));
        }
        String fileUrl = r2Endpoint + "/" + bucketName + "/" + key;

        // 5) Persist
        ProductImage imgRow = new ProductImage();
        imgRow.setProduct(productRepo.getReferenceById(productId));
        imgRow.setPublicId(key);
        imgRow.setUrl(fileUrl);
        imgRow.setWatermarkVariantUrl(fileUrl);
        imgRow.setAltText(altText);
        imgRow.setSortOrder(sortOrder != null ? sortOrder : 0);
        imgRow.setActive(true);

        return imageRepo.save(imgRow);
    }

    // ──────────────── updateProductImage (REPLACE) ────────────────
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductImage updateProductImage(ProductImageDto dto, MultipartFile newFile)
            throws IOException, InterruptedException {

        if (dto == null || dto.getId() == null || dto.getProductId() == null)
            throw new IllegalArgumentException("Image id and productId are required");

        ProductImage imgRow = imageRepo.findById(dto.getId())
                .orElseThrow(() -> new IllegalArgumentException("Image not found: " + dto.getId()));

        if (!imgRow.getProduct().getId().equals(dto.getProductId()))
            throw new IllegalArgumentException("Image does not belong to product " + dto.getProductId());

        if (newFile != null && !newFile.isEmpty()) {
            validateFile(newFile); // ← use the defined validator

            byte[] normalizedJpeg = convertAnyToJpegBytes(
                    newFile.getBytes(),
                    newFile.getOriginalFilename(),
                    newFile.getContentType()
            );

            BufferedImage decoded = ImageMagickUtil.readImage(normalizedJpeg);
            if (decoded == null) throw new IllegalArgumentException("Uploaded file is not a supported image");

            BufferedImage base = ImageUtil.fitWithin(decoded, ImageUtil.MAX_DIM);
            BufferedImage stamped = watermarkLogoOrText(base, WATERMARK_IMG, "BLOSSOM BUDS");

            byte[] finalBytes;
            try {
                finalBytes = ImageMagickUtil.targetSizeJpeg(stamped);
            } catch (Exception e) {
                finalBytes = toJpegBytes(stamped, 0.82f);
            }

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
        }

        if (dto.getAltText() != null) imgRow.setAltText(dto.getAltText());
        if (dto.getSortOrder() != null) imgRow.setSortOrder(dto.getSortOrder());
        if (dto.getActive() != null) imgRow.setActive(dto.getActive());

        return imageRepo.save(imgRow);
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

    private byte[] convertAnyToJpegBytes(byte[] raw, String filename, String contentType) throws IOException {
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
                    throw new IOException("Image conversion failed (HEIC). " + primaryFail.getMessage(), magickFail);
                }
            }
            throw new IOException("Image conversion failed. " + primaryFail.getMessage(), primaryFail);
        }
    }

    // --- 1) Presign a browser PUT to R2 (10 min)
    public PresignResponse presignPut(String filename, String contentType) {
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
        return new PresignResponse(key, url.toString(), (contentType == null || contentType.isBlank())
                ? "application/octet-stream" : contentType);
    }

    // --- 2) Read temp object, process, upload final, delete temp, persist
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductImageDto createImageFromTempKey(Long productId, String tempKey, String altText, Integer sortOrder)
            throws IOException, InterruptedException {
        if (productId == null || tempKey == null || tempKey.isBlank())
            throw new IllegalArgumentException("productId and key are required");

        S3Object obj = r2Client.getObject(bucketName, tempKey);
        BufferedImage original;
        try (InputStream in = obj.getObjectContent()) {
            original = javax.imageio.ImageIO.read(in);
        }
        if (original == null) throw new IllegalArgumentException("Uploaded file is not a supported image");

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

        try { r2Client.deleteObject(new DeleteObjectRequest(bucketName, tempKey)); } catch (Exception ignored) {}

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

    private byte[] toJpegBytes(BufferedImage image, float quality) throws IOException {
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
    }

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
        return imageRepo.findByProduct_IdOrderBySortOrderAscIdAsc(productId)
                .stream()
                .map(this::toResponse)
                .toList();
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
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteProductImage(Long productId, Long imageId) {
        if (productId == null || imageId == null)
            throw new IllegalArgumentException("productId and imageId are required");

        imageRepo.findById(imageId).ifPresent(img -> {
            if (!img.getProduct().getId().equals(productId))
                throw new IllegalArgumentException("Image does not belong to product " + productId);

            if (img.getPublicId() != null) {
                r2Client.deleteObject(new DeleteObjectRequest(bucketName, img.getPublicId()));
            }
            imageRepo.delete(img);
        });
    }

    /** Makes an image primary (sortOrder=0) and pushes others down. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void setPrimaryImage(Long productId, Long imageId) {
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
    }

    // ─────────────────────────────── Options ────────────────────────────────

    /** Creates an option for a product. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductOption createProductOption(ProductOptionDto dto) {
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
        return optionRepo.save(opt);
    }

    /** Lists options for a product ordered by sort order then id. */
    public List<ProductOption> listProductOptions(Long productId) {
        if (productId == null) throw new IllegalArgumentException("productId is required");
        return optionRepo.findByProduct_IdOrderBySortOrderAscIdAsc(productId);
    }

    /** Retrieves an option by id or throws if not found. */
    public ProductOption getProductOption(Long optionId) {
        if (optionId == null) throw new IllegalArgumentException("optionId is required");
        return optionRepo.findById(optionId)
                .orElseThrow(() -> new IllegalArgumentException("Option not found: " + optionId));
    }

    /** Updates an option’s mutable fields. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductOption updateProductOption(ProductOptionDto dto) {
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
        return opt;
    }

    /** Soft-deletes a product option (active=false via @SQLDelete). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteProductOption(Long optionId) {
        if (optionId == null) throw new IllegalArgumentException("optionId is required");
        optionRepo.findById(optionId).ifPresent(optionRepo::delete);
    }

    // ───────────────────────────── Option Values ─────────────────────────────

    /** Creates a value under an option. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductOptionValue createProductOptionValue(ProductOptionValueDto dto) {
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
        return valueRepo.save(val);
    }

    /** Lists values for an option ordered by sort order then id. */
    public List<ProductOptionValue> listOptionValues(Long optionId) {
        if (optionId == null) throw new IllegalArgumentException("optionId is required");
        return valueRepo.findByOption_IdOrderBySortOrderAscIdAsc(optionId);
    }

    /** Retrieves an option value by id scoped to its option or throws. */
    public ProductOptionValue getProductOptionValue(Long optionId, Long valueId) {
        if (optionId == null || valueId == null) {
            throw new IllegalArgumentException("optionId and valueId are required");
        }
        ProductOptionValue v = valueRepo.findById(valueId)
                .orElseThrow(() -> new IllegalArgumentException("Option value not found: " + valueId));
        if (!v.getOption().getId().equals(optionId)) {
            throw new IllegalArgumentException("Value does not belong to option " + optionId);
        }
        return v;
    }

    /** Updates an option value’s mutable fields. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductOptionValue updateProductOptionValue(ProductOptionValueDto dto) {
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
        return v;
    }

    /** Soft-deletes an option value (active=false via @SQLDelete). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteProductOptionValue(Long optionId, Long valueId) {
        if (optionId == null || valueId == null) {
            throw new IllegalArgumentException("optionId and valueId are required");
        }
        ProductOptionValue v = getProductOptionValue(optionId, valueId);
        valueRepo.delete(v);
    }

    // at the bottom of CatalogService, replace your current validateFile(...) with this:
    public void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File cannot be empty");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("Max 10 MB per image");
        }

        String name = (file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase());
        String ct   = (file.getContentType() == null ? "" : file.getContentType().toLowerCase());

        boolean extOk =
                name.endsWith(".jpg")  || name.endsWith(".jpeg") ||
                        name.endsWith(".png")  || name.endsWith(".webp") ||
                        name.endsWith(".gif")  || name.endsWith(".bmp")  ||
                        name.endsWith(".tif")  || name.endsWith(".tiff") ||
                        name.endsWith(".heic") || name.endsWith(".heif");

        boolean typeOk = ct.startsWith("image/") || extOk;

        if (!typeOk) {
            throw new IllegalArgumentException("Only image files are supported (JPG, PNG, WebP, HEIC…)");
        }
    }
    // ───────────────────── Featured Products ─────────────────────

    /** Page only featured (active=true via @Where). */
    public Page<Product> listFeaturedProducts(int page, int size) {
        return productRepo.findByFeaturedTrue(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );

        // If you want to ALSO require visible=true at DB level, use this
        // return productRepo.findByFeaturedTrueAndVisibleTrue(
        //        PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
    }

    /** Top-N featured (newest first). */
    public List<Product> listFeaturedTop(int limit) {
        int lim = Math.max(1, Math.min(100, limit));
        return productRepo.findByFeaturedTrue(
                PageRequest.of(0, lim, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();

        // Visible-gated variant:
        // return productRepo.findByFeaturedTrueAndVisibleTrue(
        //        PageRequest.of(0, lim, Sort.by(Sort.Direction.DESC, "createdAt"))
        // ).getContent();
    }
    @Transactional
    public Product setProductFeatured(Long id, boolean featured) {
        Product p = getProduct(id);
        p.setFeatured(featured);
        return p; // dirty checking persists
    }




}
