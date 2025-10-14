package com.blossombuds.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

/** Represents a sellable product in the catalog. */
@SQLDelete(sql = "UPDATE products SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "products")
public class Product {

    /** Surrogate primary key for products. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** URL-friendly unique identifier for the product. */
    @Column(length = 200, unique = true)
    private String slug;

    /** Display name of the product. */
    @Column(length = 200, nullable = false)
    private String name;

    /** Long-form product description. */
    @Column(columnDefinition = "text")
    private String description;

    /** Current list price of the product. */
    @Column(precision = 12, scale = 2)
    private BigDecimal price;

    /** Soft-visibility flag to hide/show the product. */
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

    /** Category links for this product (join rows). */
    @OneToMany(mappedBy = "product", fetch = FetchType.LAZY)
    @JsonIgnore
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Set<ProductCategory> categoryLinks = new LinkedHashSet<>();
}
