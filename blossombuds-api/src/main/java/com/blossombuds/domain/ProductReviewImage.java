package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Product review image entity (soft-deleted; active-only by default). */
@Getter @Setter
@Entity
@Table(name = "product_review_images")
@SQLDelete(sql = "UPDATE product_review_images SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
@EntityListeners(AuditingEntityListener.class)
public class ProductReviewImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "review_id")
    private Long reviewId; // FK to product_reviews.id

    @Column(name = "public_id", length = 255)
    private String publicId; // optional external id

    @Column(columnDefinition = "text")
    private String url;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    // audit
    private Boolean active = Boolean.TRUE;
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
