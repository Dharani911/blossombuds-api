package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.io.Serializable;
import java.time.OffsetDateTime;

/** Join entity linking a product to a category (M:N via product_categories). */
@SQLDelete(sql = """
  UPDATE product_categories
     SET active = false, modified_at = now()
   WHERE product_id = ? AND category_id = ?
""")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
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
    private String createdBy;

    /** Timestamp when the record was created. */
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    /** Username/actor who last modified this record. */
    @Column(name = "modified_by", length = 120)
    private String modifiedBy;

    /** Timestamp when the record was last modified. */
    @Column(name = "modified_at")
    private OffsetDateTime modifiedAt;

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
