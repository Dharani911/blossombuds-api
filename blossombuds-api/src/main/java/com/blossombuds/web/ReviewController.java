package com.blossombuds.web;

import com.blossombuds.domain.ProductReview;
import com.blossombuds.dto.*;
import com.blossombuds.service.ReviewService;


import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/reviews")
@Validated
public class ReviewController {

    private final ReviewService reviews;

    /* ---------- Create & Moderate ---------- */

    @PostMapping
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductReview submit(@Valid @RequestBody ProductReviewDto dto, Authentication auth) {
        return reviews.submit(dto, actor(auth));
    }

    @PostMapping("/{reviewId}/moderate/{status}")
    @PreAuthorize("hasRole('ADMIN')")
    public ProductReview moderate(@PathVariable @Min(1) Long reviewId,
                                  @PathVariable String status,
                                  @RequestParam(name = "override", defaultValue = "false") boolean override,
                                  Authentication auth) {
        return reviews.moderate(reviewId, status, actor(auth), override);
    }

    @DeleteMapping("/{reviewId}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @Min(1) Long reviewId, Authentication auth) {
        reviews.delete(reviewId, actor(auth));
    }

    /* ---------- Public reading ---------- */

    /** List APPROVED reviews for a product (concern=true only). */
    @GetMapping("/product/{productId}")
    public List<ProductReviewDetailView> listApproved(@PathVariable @Min(1) Long productId) {
        return reviews.listApprovedForProduct(productId);
    }

    /** Paged public list (APPROVED + concern=true) with optional q. */
    @GetMapping
    public Page<ProductReviewPublicView> listPublic(
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "createdAt",
                    direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {

        return reviews.searchPublicApproved(q, pageable);
    }

    /* ---------- Admin search ---------- */

    @GetMapping("/admin")
    //@PreAuthorize("hasRole('ADMIN')")
    public Page<ProductReview> adminList(
            @RequestParam(required = false) String status,           // PENDING/APPROVED/REJECTED
            @RequestParam(required = false) Boolean concern,         // optional
            @RequestParam(required = false) String q,                // free text / ids
            @PageableDefault(size = 20, sort = "createdAt",
                    direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return reviews.search(status, concern, q, pageable);
    }

    /* ---------- Detail (owner/admin) ---------- */

    /** Owner/Admin can fetch review detail (with signed image URLs). */
    @GetMapping("/{reviewId}")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public ProductReviewDetailView getDetail(@PathVariable @Min(1) Long reviewId, Authentication auth) {
        return reviews.getDetail(reviewId, actor(auth));
    }

    /* ---------- Images: upload / attach / reorder / delete ---------- */

    /** Direct multipart upload for a review image (HEIC accepted, converts to JPEG). */
    @PostMapping("/{reviewId}/images/upload")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public ProductReviewImageDto uploadImage(@PathVariable @Min(1) Long reviewId,
                                             @RequestPart("file") MultipartFile file,
                                             Authentication auth) throws Exception {
        var row = reviews.uploadImage(reviewId, file, actor(auth));
        var dto = new ProductReviewImageDto();
        dto.setId(row.getId());
        dto.setPublicId(row.getPublicId());
        dto.setUrl(row.getUrl());
        dto.setSortOrder(row.getSortOrder());
        return dto;
    }

    /** Get presigned PUT for browser upload to a temp key. */
    @PostMapping("/images/presign")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public PresignResponse presignImageUpload(
            @RequestBody(required = false) Map<String, String> body,
            @RequestParam(value = "filename", required = false) String filenameParam,
            @RequestParam(value = "contentType", required = false) String contentTypeParam) {

        // accept either JSON body OR query params
        String filename = (body != null && body.get("filename") != null) ? body.get("filename") : filenameParam;
        String contentType = (body != null && body.get("contentType") != null) ? body.get("contentType") : contentTypeParam;

        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("Missing parameter: filename");
        }
        if (contentType == null || contentType.isBlank()) {
            contentType = "application/octet-stream";
        }
        return reviews.presignPutForReview(filename, contentType);
    }

    @GetMapping("/{reviewId}/images/{imageId}/inline")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public ResponseEntity<ByteArrayResource> inlineImage(
            @PathVariable @Min(1) Long reviewId,
            @PathVariable @Min(1) Long imageId,
            Authentication auth
    ) throws IOException {
        var payload = reviews.streamReviewImage(reviewId, imageId, actor(auth));
        ByteArrayResource body = new ByteArrayResource(payload.getBytes());

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(payload.getContentType()))
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(30)).cachePublic())
                // If your frontend is on a different origin, either configure global CORS
                // or uncomment the header below for quick testing:
                // .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173")
                .header(HttpHeaders.VARY, "Origin")
                .header(HttpHeaders.ETAG, Integer.toHexString(java.util.Arrays.hashCode(payload.getBytes())))
                .body(body);
    }
    @PostMapping("/images/tmp/delete")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTempUpload(@RequestBody Map<String, String> body) {
        String key = body.get("key");
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("Missing parameter: key");
        }
        reviews.deleteTempObject(key);
    }

    /** Attach an already uploaded temp object to a review (normalizes to final key). */
    @PostMapping("/{reviewId}/images/attach")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public ProductReviewImageDto attachFromTempKey(
            @PathVariable @Min(1) Long reviewId,
            @RequestBody Map<String, String> body,
            Authentication auth
    ) throws IOException {
        String key = body.get("key");
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("Missing parameter: key");
        }
        var saved = reviews.attachImageFromTempKey(reviewId, key, actor(auth));
        // return a lightweight DTO for the client
        ProductReviewImageDto dto = new ProductReviewImageDto();
        dto.setId(saved.getId());
        dto.setPublicId(saved.getPublicId());
        dto.setUrl(saved.getUrl());          // server may return a signed GET
        dto.setSortOrder(saved.getSortOrder());
        return dto;
    }

    @PostMapping("/{reviewId}/images/reorder")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorderImages(@PathVariable @Min(1) Long reviewId,
                              @RequestBody List<Long> imageIds,
                              Authentication auth) {
        reviews.reorderImages(reviewId, imageIds, actor(auth));
    }

    @DeleteMapping("/{reviewId}/images/{imageId}")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteImage(@PathVariable @Min(1) Long reviewId,
                            @PathVariable @Min(1) Long imageId,
                            Authentication auth) {
        reviews.deleteImage(reviewId, imageId, actor(auth));
    }

    // helper
    private String actor(Authentication auth) {
        return (auth != null && auth.getName() != null) ? auth.getName() : "system";
    }
}
