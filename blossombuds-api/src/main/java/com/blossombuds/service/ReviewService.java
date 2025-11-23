// com.blossombuds.service.ReviewService
package com.blossombuds.service;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.*;
import com.blossombuds.domain.Customer;
import com.blossombuds.domain.ProductReview;
import com.blossombuds.domain.ProductReviewImage;
import com.blossombuds.dto.*;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.repository.ProductReviewImageRepository;
import com.blossombuds.repository.ProductReviewRepository;
import com.blossombuds.util.ImageUtil;
import jakarta.persistence.criteria.Subquery;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.URL;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReviewService {

    private final ProductReviewRepository reviewRepo;
    private final ProductReviewImageRepository imageRepo;
    private  final CustomerRepository customerRepository;

    // R2 / S3 (reuse your existing config)
    private final AmazonS3 r2Client;
    @Value("${cloudflare.r2.bucket}")   private String bucketName;
    @Value("${cloudflare.r2.endpoint}") private String r2Endpoint;





    private static final long MAX_BYTES = 10L * 1024 * 1024;

    // ───────────────────────── Reviews ─────────────────────────

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public ProductReview submit(com.blossombuds.dto.@Valid ProductReviewDto dto, String actor) {
        log.info("[REVIEW][SUBMIT] Submitting review for productId={} customerId={} actor={}",
                dto.getProductId(), dto.getCustomerId(), actor);

        if (dto == null) throw new IllegalArgumentException("ProductReviewDto is required");
        if (dto.getProductId() == null) throw new IllegalArgumentException("productId is required");
        if (dto.getCustomerId() == null) throw new IllegalArgumentException("customerId is required");
        if (dto.getRating() == null || dto.getRating() < 1 || dto.getRating() > 5)
            throw new IllegalArgumentException("rating must be between 1 and 5");
        if (dto.getConcern() == null)
            throw new IllegalArgumentException("concern boolean is required");

        ensureActorIsAdminOrCustomerSelf(actor, dto.getCustomerId());

        // (Optional) Enforce: only after delivery if orderId present.
        // Hook here to verify delivered status via OrderRepository if you want.

        ProductReview r = new ProductReview();
        r.setProductId(dto.getProductId());
        r.setOrderId(dto.getOrderId());
        r.setOrderItemId(dto.getOrderItemId());
        r.setCustomerId(dto.getCustomerId());

        r.setRating(dto.getRating());
        r.setTitle(safeTrim(limit(dto.getTitle(), 200)));
        r.setBody(safeTrim(limit(dto.getBody(), 4000)));
        r.setConcern(Boolean.TRUE.equals(dto.getConcern())); // NEW
        r.setStatus("PENDING");
        r.setActive(Boolean.TRUE);
        reviewRepo.save(r);

        // Attach any pre-uploaded images (max 3)
        List<ProductReviewImageDto> src = dto.getImages() == null ? List.of() : dto.getImages();
        int count = Math.min(src.size(), 3);
        List<ProductReviewImage> batch = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            ProductReviewImageDto imgDto = src.get(i);
            if (imgDto == null) continue;
            ProductReviewImage img = new ProductReviewImage();
            img.setReviewId(r.getId());
            img.setPublicId(safeTrim(imgDto.getPublicId()));
            img.setUrl(safeTrim(imgDto.getUrl()));
            img.setSortOrder(i);
            img.setActive(Boolean.TRUE);
            batch.add(img);
        }
        if (!batch.isEmpty()) imageRepo.saveAll(batch);

        log.info("[REVIEW][SUBMIT] Submitted review id={} with {} image(s)", r.getId(), batch.size());
        return r;
    }

    /** Admin approve/reject; APPROVE requires concern=true unless override. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ProductReview moderate(Long reviewId, String status, String actor, boolean overrideConsent) {
        log.info("[REVIEW][MODERATE] Moderating reviewId={} status={} actor={} override={}",
                reviewId, status, actor, overrideConsent);

        if (reviewId == null) throw new IllegalArgumentException("reviewId is required");
        String s = safeTrim(status);
        if (!"APPROVED".equals(s) && !"REJECTED".equals(s))
            throw new IllegalArgumentException("status must be APPROVED or REJECTED");
        ProductReview r = reviewRepo.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));

        if ("APPROVED".equals(s) && !Boolean.TRUE.equals(r.getConcern()) && !overrideConsent) {
            throw new IllegalStateException("Cannot approve without customer concern=true");
        }
        r.setStatus(s);
        log.info("[REVIEW][MODERATE] Review id={} updated to status={}", reviewId, s);
        return r;
    }

    /** Public site: only APPROVED and concern=true. */
    public List<ProductReviewDetailView> listApprovedForProduct(Long productId) {
        log.debug("[REVIEW][LIST] Listing approved reviews for productId={}", productId);

        if (productId == null) throw new IllegalArgumentException("productId is required");
        // Ensure repo method filters active=true OR filter here after fetching
        List<ProductReview> rows =
                reviewRepo.findByProductIdAndStatusOrderByIdDesc(productId, "APPROVED");
        List<ProductReviewDetailView> out = new ArrayList<>();
        for (ProductReview r : rows) {
            if (!Boolean.TRUE.equals(r.getActive())) continue;            // <— add
            if (!Boolean.TRUE.equals(r.getConcern())) continue;           // already present logic
            out.add(toDetail(r));
        }
        log.info("[REVIEW][LIST] Found {} approved reviews for productId={}", out.size(), productId);
        return out;
    }

    /** Admin/owner read detail with images (signed URLs). */
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public ProductReviewDetailView getDetail(Long reviewId, String actor) {
        log.info("[REVIEW][DETAIL] Fetching detail for reviewId={} actor={}", reviewId, actor);
        ProductReview r = reviewRepo.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));
        if (actor.startsWith("cust:")) ensureActorIsAdminOrCustomerSelf(actor, r.getCustomerId());
        return toDetail(r);
    }

    /** Owner/admin soft delete. */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public void delete(Long reviewId, String actor) {
        log.info("[REVIEW][DELETE] Soft-deleting reviewId={} by actor={}", reviewId, actor);
        ProductReview r = reviewRepo.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));
        ensureActorIsAdminOrCustomerSelf(actor, r.getCustomerId());
        r.setActive(Boolean.FALSE);
        log.info("[REVIEW][DELETE] Marked reviewId={} as inactive", reviewId);
    }

    // ───────────── Image upload (Multipart) — HEIC OK, no watermark ─────────────

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public ProductReviewImage uploadImage(Long reviewId, MultipartFile file, String actor)
            throws IOException {
        log.info("[REVIEW][UPLOAD] Uploading image for reviewId={} actor={} filename={}",
                reviewId, actor, file != null ? file.getOriginalFilename() : "null");

        if (reviewId == null) throw new IllegalArgumentException("reviewId is required");
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("File cannot be empty");

        ProductReview r = reviewRepo.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));
        ensureActorIsAdminOrCustomerSelf(actor, r.getCustomerId());

        List<ProductReviewImage> existing =
                imageRepo.findByReviewIdAndActiveTrueOrderBySortOrderAsc(reviewId);
        if (existing.size() >= 3) {
            throw new IllegalStateException("Maximum 3 images per review");
        }

        // Validate type/size (no HEIC)
        validateFile(file);

        // Decode using pure Java
        BufferedImage original;
        try (InputStream in = file.getInputStream()) {
            original = ImageIO.read(in);
        }
        if (original == null) {
            throw new IllegalArgumentException(
                    "Uploaded file is not a supported image (JPG, PNG, WebP, GIF, BMP, TIFF).");
        }

        // Resize + compress using your ImageUtil
        BufferedImage resized = ImageUtil.fitWithin(original, ImageUtil.MAX_DIM);
        byte[] jpegBytes = ImageUtil.toJpegUnderCap(resized);

        // Upload to R2 under reviews/{reviewId}/
        String key = "reviews/" + reviewId + "/" + UUID.randomUUID() + ".jpg";
        ObjectMetadata meta = new ObjectMetadata();
        meta.setContentType("image/jpeg");
        meta.setContentLength(jpegBytes.length);

        try (InputStream in = new ByteArrayInputStream(jpegBytes)) {
            r2Client.putObject(new PutObjectRequest(bucketName, key, in, meta));
        }
        String fileUrl = r2Endpoint + "/" + bucketName + "/" + key;

        ProductReviewImage row = new ProductReviewImage();
        row.setReviewId(reviewId);
        row.setPublicId(key);
        row.setUrl(fileUrl);
        row.setSortOrder(existing.size());
        row.setActive(Boolean.TRUE);

        log.info("[REVIEW][UPLOAD] Image uploaded to key={} size={}B", key, jpegBytes.length);
        return imageRepo.save(row);
    }


    // ───── Presign + finalize (browser uploads to temp key; then attach) ─────

    public PresignResponse presignPutForReview(String filename, String contentType) {
        String safeName = (filename == null ? "file" : filename.replaceAll("[^A-Za-z0-9._-]", "_"));
        String key = "uploads/reviews/tmp/" + UUID.randomUUID() + "/" + safeName;
        Date exp = Date.from(Instant.now().plus(Duration.ofMinutes(10)));

        GeneratePresignedUrlRequest req = new GeneratePresignedUrlRequest(bucketName, key)
                .withMethod(com.amazonaws.HttpMethod.PUT)
                .withExpiration(exp);
        if (contentType != null && !contentType.isBlank()) {
            req.addRequestParameter("Content-Type", contentType);
        }
        URL url = r2Client.generatePresignedUrl(req);
        log.debug("[REVIEW][PRESIGN] Presigned URL for key={} expires={}", key, exp);
        return new PresignResponse(key, url.toString(),
                (contentType == null || contentType.isBlank()) ? "application/octet-stream" : contentType);
    }

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public ProductReviewImageDto attachImageFromTempKey(Long reviewId, String tempKey, String actor)
            throws IOException {
        log.info("[REVIEW][ATTACH] Attaching image from tempKey={} to reviewId={} by actor={}",
                tempKey, reviewId, actor);

        if (reviewId == null || !StringUtils.hasText(tempKey))
            throw new IllegalArgumentException("reviewId and key are required");

        ProductReview r = reviewRepo.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));
        ensureActorIsAdminOrCustomerSelf(actor, r.getCustomerId());

        List<ProductReviewImage> existing =
                imageRepo.findByReviewIdAndActiveTrueOrderBySortOrderAsc(reviewId);
        if (existing.size() >= 3) {
            throw new IllegalStateException("Maximum 3 images per review");
        }

        // Download temp object bytes
        byte[] raw;
        try (S3Object obj = r2Client.getObject(bucketName, tempKey);
             InputStream in = obj.getObjectContent();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            in.transferTo(baos);
            raw = baos.toByteArray();
        }

        // Decode & validate as image
        BufferedImage original = ImageIO.read(new ByteArrayInputStream(raw));
        if (original == null) {
            log.warn("[REVIEW][ATTACH][FAIL] Unsupported image tempKey={}", tempKey);
            throw new IllegalArgumentException(
                    "Uploaded file is not a supported image (JPG, PNG, WebP, GIF, BMP, TIFF).");
        }

        // Resize + compress to JPEG
        BufferedImage resized = ImageUtil.fitWithin(original, ImageUtil.MAX_DIM);
        byte[] jpegBytes = ImageUtil.toJpegUnderCap(resized);

        String destKey = "reviews/" + reviewId + "/" + UUID.randomUUID() + ".jpg";
        ObjectMetadata meta = new ObjectMetadata();
        meta.setContentType("image/jpeg");
        meta.setContentLength(jpegBytes.length);
        try (InputStream up = new ByteArrayInputStream(jpegBytes)) {
            r2Client.putObject(new PutObjectRequest(bucketName, destKey, up, meta));
        }

        // Best-effort delete temp object
        try { r2Client.deleteObject(new DeleteObjectRequest(bucketName, tempKey)); }
        catch (Exception ignore) {
            log.warn("[REVIEW][ATTACH] Could not delete temp key='{}' (ignored)", tempKey);
        }

        ProductReviewImage row = new ProductReviewImage();
        row.setReviewId(reviewId);
        row.setPublicId(destKey);
        row.setUrl(r2Endpoint + "/" + bucketName + "/" + destKey);
        row.setSortOrder(existing.size());
        row.setActive(Boolean.TRUE);
        ProductReviewImage saved = imageRepo.save(row);

        ProductReviewImageDto dto = new ProductReviewImageDto();
        dto.setId(saved.getId());
        dto.setPublicId(saved.getPublicId());
        dto.setUrl(saved.getUrl());
        dto.setSortOrder(saved.getSortOrder());
        log.info("[REVIEW][ATTACH] Image attached at {} and saved with ID {}", destKey, saved.getId());
        return dto;
    }

    /*@Async("reviewExecutor")
    @Transactional
    public void transcodeHeicToJpegAsync(Long imageRowId, String heicKey) {
        log.info("[REVIEW][HEIC] Transcoding HEIC to JPEG for imageId={} key={}", imageRowId, heicKey);
        try (S3Object obj = r2Client.getObject(bucketName, heicKey);
             InputStream in = obj.getObjectContent();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            in.transferTo(baos);
            byte[] raw = baos.toByteArray();

            byte[] jpeg = convertAnyToJpegBytes(raw, heicKey, "image/heic");
            try { jpeg = ImageMagickUtil.targetSizeJpeg(ImageMagickUtil.readImage(jpeg)); } catch (Exception ignore) {}

            String jpgKey = heicKey.replaceAll("\\.(heic|heif)$", ".jpg");
            if (jpgKey.equals(heicKey)) {
                jpgKey = "reviews/" + imageRowId + "/" + UUID.randomUUID() + ".jpg";
            }

            var meta = new ObjectMetadata();
            meta.setContentType("image/jpeg");
            meta.setContentLength(jpeg.length);
            try (InputStream up = new ByteArrayInputStream(jpeg)) {
                r2Client.putObject(new PutObjectRequest(bucketName, jpgKey, up, meta));
            }

            try { r2Client.deleteObject(new DeleteObjectRequest(bucketName, heicKey)); } catch (Exception ignore) {}

            var row = imageRepo.findById(imageRowId)
                    .orElseThrow(() -> new IllegalArgumentException("Image not found: " + imageRowId));
            row.setPublicId(jpgKey);
            row.setUrl(r2Endpoint + "/" + bucketName + "/" + jpgKey);
            imageRepo.save(row);
            log.info("[REVIEW][HEIC] Transcoded and saved JPEG at {}", jpgKey);
        } catch (Exception e) {
            log.warn("[REVIEW][HEIC] Async transcode failed imageId={} key={} err={}", imageRowId, heicKey, e.toString());
        }
    }*/


    // tiny helper
    private static String extFromKey(String key) {
        String k = key.toLowerCase(Locale.ROOT);
        if (k.endsWith(".jpg") || k.endsWith(".jpeg")) return ".jpg";
        if (k.endsWith(".png")) return ".png";
        if (k.endsWith(".webp")) return ".webp";
        if (k.endsWith(".gif")) return ".gif";
        if (k.endsWith(".tif") || k.endsWith(".tiff")) return ".tiff";
        if (k.endsWith(".bmp")) return ".bmp";
        if (k.endsWith(".heic")) return ".heic";
        if (k.endsWith(".heif")) return ".heif";
        return ".bin";
    }


    // ───────────── Manage images (reorder/delete) ─────────────

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public void reorderImages(Long reviewId, List<Long> imageIds, String actor) {
        log.info("[REVIEW][ORDER] Reordering images for reviewId={} actor={}", reviewId, actor);

        if (reviewId == null) throw new IllegalArgumentException("reviewId is required");
        ProductReview r = reviewRepo.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));
        ensureActorIsAdminOrCustomerSelf(actor, r.getCustomerId());

        List<ProductReviewImage> current = imageRepo.findByReviewIdAndActiveTrueOrderBySortOrderAsc(reviewId);

        Map<Long, ProductReviewImage> byId = new LinkedHashMap<>();
        for (ProductReviewImage im : current) byId.put(im.getId(), im);

        List<ProductReviewImage> ordered = new ArrayList<>();
        if (imageIds != null) {
            for (Long id : imageIds) {
                ProductReviewImage im = byId.remove(id);
                if (im != null) ordered.add(im);
            }
        }
        ordered.addAll(byId.values());

        for (int i = 0; i < ordered.size(); i++) ordered.get(i).setSortOrder(i);
        imageRepo.saveAll(ordered);
        log.info("[REVIEW][ORDER] New image order saved for reviewId={} with {} image(s)", reviewId, ordered.size());

    }

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public void deleteImage(Long reviewId, Long imageId, String actor) {
        log.info("[REVIEW][DELETE_IMAGE] Deleting imageId={} from reviewId={} by actor={}", imageId, reviewId, actor);

        if (reviewId == null || imageId == null) throw new IllegalArgumentException("ids required");
        ProductReview r = reviewRepo.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));
        ensureActorIsAdminOrCustomerSelf(actor, r.getCustomerId());

        ProductReviewImage im = imageRepo.findById(imageId)
                .orElseThrow(() -> new IllegalArgumentException("Image not found: " + imageId));
        if (!reviewId.equals(im.getReviewId())) throw new IllegalArgumentException("Image does not belong to this review");

        // delete file from R2 (optional but recommended)
        if (im.getPublicId() != null) {
            try { r2Client.deleteObject(new DeleteObjectRequest(bucketName, im.getPublicId())); } catch (Exception ignore) {}
        }
        im.setActive(Boolean.FALSE);
        imageRepo.save(im);

        // Repack sort order
        List<ProductReviewImage> remain = imageRepo.findByReviewIdAndActiveTrueOrderBySortOrderAsc(reviewId);
        for (int i = 0; i < remain.size(); i++) remain.get(i).setSortOrder(i);
        imageRepo.saveAll(remain);
        log.info("[REVIEW][DELETE_IMAGE] Image marked inactive and removed from R2 if present");
    }
    public Page<ProductReviewPublicView> searchPublicApproved(String q, Pageable pageable) {
        log.debug("[REVIEW][SEARCH_PUBLIC] Querying public approved reviews: query='{}'", q);

        // Reuse your existing search: APPROVED + concern=true + active=true
        Page<ProductReview> page = search("APPROVED", Boolean.TRUE, q, pageable);

        // 1) Batch load customers
        List<Long> custIds = page.getContent().stream()
                .map(ProductReview::getCustomerId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, Customer> byId = customerRepository.findAllById(custIds)
                .stream().collect(java.util.stream.Collectors.toMap(Customer::getId, c -> c));

        // 2) Map each review → public DTO (with customerName)
        List<ProductReviewPublicView> rows = new ArrayList<>(page.getNumberOfElements());
        for (ProductReview r : page.getContent()) {
            ProductReviewPublicView v = new ProductReviewPublicView();
            v.setId(r.getId());
            v.setProductId(r.getProductId());
            v.setRating(r.getRating());
            v.setTitle(r.getTitle());
            v.setBody(r.getBody());
            v.setCreatedAt(r.getCreatedAt());
            v.setCustomerId(r.getCustomerId());

            Customer cust = byId.get(r.getCustomerId());
            v.setCustomerName(cust != null ? cust.getName() : null);

            // OPTIONAL: include a signed URL for the first active image (if any)
            try {
                List<ProductReviewImage> imgs = imageRepo
                        .findByReviewIdAndActiveTrueOrderBySortOrderAsc(r.getId());
                if (!imgs.isEmpty()) {
                    ProductReviewImage first = imgs.get(0);
                    if (first.getPublicId() != null && !first.getPublicId().isBlank()) {
                        v.setFirstImageUrl(signGetUrl(first.getPublicId(), Duration.ofMinutes(30)));
                    } else if (first.getUrl() != null) {
                        v.setFirstImageUrl(first.getUrl());
                    }
                }
            } catch (Exception ignored) {
                // keep firstImageUrl null on any error
            }

            rows.add(v);
        }

        log.info("[REVIEW][SEARCH_PUBLIC] Found {} results for query='{}'", rows.size(), q);
        return new PageImpl<>(rows, page.getPageable(), page.getTotalElements());
    }

    // ───────────── Search (admin) — status/concern/q ─────────────

    //@PreAuthorize("hasRole('ADMIN',CUSTOMER)")
    public Page<ProductReview> search(String status, Boolean concern, String q, Pageable pageable) {
        log.debug("[REVIEW][SEARCH_ADMIN] search() called with status='{}' concern={} query='{}'", status, concern, q);
        Specification<ProductReview> spec = alwaysTrue();

        // active = true by default
        spec = spec.and((root, query, cb) -> cb.isTrue(root.get("active")));

        if (status != null && !status.isBlank()) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(cb.upper(root.get("status")), status.trim().toUpperCase()));
        }

        if (concern != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("concern"), concern));
        }

        if (q != null && !q.isBlank()) {
            final String like = "%" + q.trim().toLowerCase() + "%";

            // match title/body
            Specification<ProductReview> text = (root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("title")), like),
                    cb.like(cb.lower(root.get("body")),  like)
            );
            spec = spec.and(text);

            // numeric id match (productId / customerId / review id)
            try {
                Long n = Long.valueOf(q.trim());
                Specification<ProductReview> idMatch = (root, query, cb) -> cb.or(
                        cb.equal(root.get("productId"), n),
                        cb.equal(root.get("customerId"), n),
                        cb.equal(root.get("id"),        n)
                );
                spec = spec.or(idMatch);
            } catch (NumberFormatException ignored) {}

            // 🔎 customer name match via subquery → root.customerId IN (SELECT c.id FROM Customer c WHERE LOWER(c.name) LIKE ?)
            Specification<ProductReview> custNameMatch = (root, query, cb) -> {
                Subquery<Long> sq = query.subquery(Long.class);
                var c = sq.from(Customer.class);
                sq.select(c.get("id"))
                        .where(cb.like(cb.lower(c.get("name")), like));
                return root.get("customerId").in(sq);
            };
            spec = spec.or(custNameMatch);
        }

        return reviewRepo.findAll(spec, pageable);
    }

    // in ReviewService
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public void deleteTempObject(String key) {
        log.info("[REVIEW][TEMP_DELETE] Attempting to delete temp object: {}", key);
        if (key == null || key.isBlank())
            throw new IllegalArgumentException("key required");
        // Safety: only allow deleting objects in the temp folder
        if (!key.startsWith("uploads/reviews/tmp/"))
            throw new IllegalArgumentException("not a temp key");
        try {
            r2Client.deleteObject(new DeleteObjectRequest(bucketName, key));
        } catch (Exception e) {
            log.warn("Temp delete failed for {}: {}", key, e.toString());
        }
        log.info("[REVIEW][TEMP_DELETE] Temp object deleted successfully: {}", key);
    }



    // ───────────────────── helpers (mirroring CatalogService) ─────────────────────

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File cannot be empty");
        }

        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("Max 10 MB per image");
        }

        String name = Optional.ofNullable(file.getOriginalFilename())
                .orElse("")
                .toLowerCase(Locale.ROOT);

        String ct = Optional.ofNullable(file.getContentType())
                .orElse("")
                .toLowerCase(Locale.ROOT);

        boolean extOk =
                name.endsWith(".jpg")  || name.endsWith(".jpeg") ||
                        name.endsWith(".png")  || name.endsWith(".webp") ||
                        name.endsWith(".gif")  || name.endsWith(".bmp")  ||
                        name.endsWith(".tif")  || name.endsWith(".tiff");

        boolean mimeOk = ct.startsWith("image/");

        if (!(extOk && mimeOk)) {
            throw new IllegalArgumentException(
                    "Only JPG, PNG, WebP, GIF, BMP, TIFF images are supported (no HEIC). You uploaded: " + name);
        }
    }





    private String guessContentType(String name, String fallback) {
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

    private String signGetUrl(String key, Duration ttl) {
        Date exp = Date.from(Instant.now().plus(ttl));
        GeneratePresignedUrlRequest req = new GeneratePresignedUrlRequest(bucketName, key)
                .withMethod(com.amazonaws.HttpMethod.GET)
                .withExpiration(exp);
        URL url = r2Client.generatePresignedUrl(req);
        return url.toString();
    }


    /** Returns the image bytes and content-type for a given review image (owner/admin). */
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public ImagePayload streamReviewImage(Long reviewId, Long imageId, String actor) throws IOException {
        log.info("[REVIEW][STREAM] Streaming imageId={} for reviewId={} by actor={}", imageId, reviewId, actor);
        if (reviewId == null || imageId == null) throw new IllegalArgumentException("ids required");

        ProductReview r = reviewRepo.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));
        // owner/admin check
        ensureActorIsAdminOrCustomerSelf(actor, r.getCustomerId());

        ProductReviewImage im = imageRepo.findById(imageId)
                .orElseThrow(() -> new IllegalArgumentException("Image not found: " + imageId));
        if (!reviewId.equals(im.getReviewId())) {
            throw new IllegalArgumentException("Image does not belong to this review");
        }
        if (im.getPublicId() == null || im.getPublicId().isBlank()) {
            throw new IllegalStateException("Image is missing storage key");
        }

        // Read bytes from R2 directly (no signed URL → same-origin stream)
        try (S3Object obj = r2Client.getObject(bucketName, im.getPublicId());
             InputStream in = obj.getObjectContent();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            in.transferTo(baos);
            byte[] bytes = baos.toByteArray();

            // Try to preserve content-type; default to JPEG
            String ct = Optional.ofNullable(obj.getObjectMetadata())
                    .map(ObjectMetadata::getContentType)
                    .orElse(MediaType.IMAGE_JPEG_VALUE);

            log.info("[REVIEW][STREAM] Stream ready for imageId={} with ct={}", imageId, ct);
            return new ImagePayload(bytes, ct);
        }
    }

    @Data
    public static class ImagePayload {
        private final byte[] bytes;
        private final String contentType;
    }


    private ProductReviewDetailView toDetail(ProductReview r) {
        ProductReviewDetailView v = new ProductReviewDetailView();
        v.setId(r.getId());
        v.setProductId(r.getProductId());
        v.setOrderId(r.getOrderId());
        v.setOrderItemId(r.getOrderItemId());
        v.setCustomerId(r.getCustomerId());
        Customer cust = customerRepository.findById(r.getCustomerId()).orElseThrow(() -> new IllegalArgumentException("Customer not found: " + r.getCustomerId()));
        v.setCustomerName(cust.getName());
        v.setRating(r.getRating());
        v.setTitle(r.getTitle());
        v.setBody(r.getBody());
        v.setStatus(r.getStatus());
        v.setConcern(Boolean.TRUE.equals(r.getConcern()));
        v.setCreatedAt(r.getCreatedAt());

        List<ProductReviewImage> imgs = imageRepo.findByReviewIdAndActiveTrueOrderBySortOrderAsc(r.getId());
        List<ProductReviewImageDto> out = new ArrayList<>(imgs.size());
        for (ProductReviewImage im : imgs) {
            ProductReviewImageDto d = new ProductReviewImageDto();
            d.setId(im.getId());
            d.setPublicId(im.getPublicId());
            // return a signed URL for safe display (30 mins)
            d.setUrl(im.getPublicId() != null ? signGetUrl(im.getPublicId(), Duration.ofMinutes(30)) : im.getUrl());
            d.setSortOrder(im.getSortOrder());
            out.add(d);
        }
        v.setImages(out);
        return v;
    }

    private static String safeTrim(String s) { return s == null ? null : s.trim(); }
    private static String limit(String s, int max) { return s == null ? null : (s.length() <= max ? s : s.substring(0, max)); }

    private void ensureActorIsAdminOrCustomerSelf(String actor, Long targetCustomerId) {
        if (targetCustomerId == null) throw new IllegalArgumentException("targetCustomerId is required");
        if (actor == null || actor.isBlank()) throw new IllegalArgumentException("actor is required");
        if (actor.startsWith("cust:")) {
            try {
                Long cid = Long.parseLong(actor.substring("cust:".length()));
                if (!targetCustomerId.equals(cid)) throw new IllegalArgumentException("Operation not permitted for this customer");
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException("Invalid customer principal");
            }
        }
    }







    private static <T> Specification<T> alwaysTrue() {
        return (root, cq, cb) -> cb.conjunction();
    }
}
