package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Join entity linking a product to a category (M:N via product_categories). */
@SQLDelete(sql = """
  UPDATE product_categories
     SET active = false, modified_at = now()
   WHERE product_id = ? AND category_id = ?
""")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@Entity @Table(name = "product_categories")
public class ProductCategory {

    /** Composite key (product_id + category_id) embedded in this entity. */
    @EmbeddedId
    private PK id;

    /** Linked product side of the association. */
    @ManyToOne(fetch = FetchType.LAZY) @MapsId("productId")
    @JoinColumn(name = "product_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Product product;

    /** Linked category side of the association. */
    @ManyToOne(fetch = FetchType.LAZY) @MapsId("categoryId")
    @JoinColumn(name = "category_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Category category;

    /** Soft-visibility flag for this mapping row. */
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

    /** Embeddable composite key class for product_categories. */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    @Embeddable
    public static class PK implements Serializable {
        /** FK to products.id participating in the composite key. */
        @Column(name = "product_id")
        private Long productId;

        /** FK to categories.id participating in the composite key. */
        @Column(name = "category_id")
        private Long categoryId;
    }
}
