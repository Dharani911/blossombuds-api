package com.blossombuds.domain;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Stores external image URLs and metadata for a product. */
@SQLDelete(sql = "UPDATE product_images SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "product_images")
public class ProductImage {

    /** Surrogate primary key for images. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Owning product for this image. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnore
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Product product;

    /** Optional public identifier from a CDN provider. */
    @Column(name = "public_id", length = 255)
    private String publicId;

    /** Full-size image URL. */
    @Column(columnDefinition = "text")
    private String url;

    /** Watermarked/low-res variant URL (if any). */
    @Column(name = "watermark_variant_url", columnDefinition = "text")
    private String watermarkVariantUrl;

    /** Alt text for accessibility/SEO. */
    @Column(name = "alt_text", length = 200)
    private String altText;

    /** Display order among a product’s images. */
    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    /** Native image width in px (optional). */
    private Integer width;

    /** Native image height in px (optional). */
    private Integer height;

    /** Soft-visibility flag to hide/show the image. */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Username/actor who created this record. */
    @Column(name = "created_by", length = 120)
    @CreatedBy
    private String createdBy;

    @Column(name = "created_at")
    @CreatedDate
    private LocalDateTime createdAt;

    @Column(name = "modified_by", length = 120)
    @LastModifiedBy
    private String modifiedBy;

    /** Timestamp when the record was last modified. */
    @Column(name = "modified_at")
    @LastModifiedDate
    private LocalDateTime modifiedAt;
}
