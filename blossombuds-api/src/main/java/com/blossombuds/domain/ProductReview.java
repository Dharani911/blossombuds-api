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

/** Product review entity (soft-deleted; active-only by default). */
@Getter @Setter
@Entity
@Table(name = "product_reviews")
@SQLDelete(sql = "UPDATE product_reviews SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
@EntityListeners(AuditingEntityListener.class)
public class ProductReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id")
    private Long productId; // FK to products.id

    @Column(name = "order_id")
    private Long orderId; // FK to orders.id (nullable)

    @Column(name = "order_item_id")
    private Long orderItemId; // FK to order_items.id (nullable)

    @Column(name = "customer_id")
    private Long customerId; // FK to customers.id


    private Short rating;                 // 1..5
    @Column(length = 150)
    private String title;                 // short title
    @Column(columnDefinition = "text")
    private String body;                  // full text

    @Column(length = 16)
    private String status;                // PENDING | APPROVED | REJECTED

    @Column(name = "concern", nullable = false)
    private Boolean concern = Boolean.FALSE;
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
