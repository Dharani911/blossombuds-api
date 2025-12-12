package com.blossombuds.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

/** Represents a sellable product in the catalog. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity
@Table(name = "products")
@EntityListeners(AuditingEntityListener.class)
// Soft-delete = hide from lists (visible=false), but keep the row.
@SQLDelete(sql = "UPDATE products SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true") //
@com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
public class Product {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 200, unique = true)
    private String slug;

    @Column(length = 200, nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(precision = 12, scale = 2)
    private BigDecimal price;

    /** Buyable flag. false = show as disabled/“coming soon”. */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Listable flag. false = fully hidden from storefront lists/search. */
    @Column(nullable = false)
    private Boolean visible = Boolean.TRUE;

    /** Home/Featured rail toggle + order. */
    @Column(nullable = false)
    private Boolean featured = Boolean.FALSE;

    @Column(name = "featured_rank", nullable = false)
    private Integer featuredRank = 0;

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

    @OneToMany(mappedBy = "product", fetch = FetchType.LAZY)
    @JsonIgnore
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Set<ProductCategory> categoryLinks = new LinkedHashSet<>();

    @OneToMany(mappedBy = "product", fetch = FetchType.LAZY)
    @OrderBy("sortOrder ASC")
    @JsonIgnore
    private Set<ProductImage> images = new LinkedHashSet<>();

    /**
     * Safer accessor for Jackson that avoids touching the proxy if not initialized,
     * OR simply returns null if we want to force explicit loading.
     * Ideally, for caching entities, we should cache DTOs, but for now we safeguard the Entity.
     */
    @JsonProperty("images")
    public java.util.List<ProductImage> getImagesSafe() {
        if (org.hibernate.Hibernate.isInitialized(images)) {
            return new java.util.ArrayList<>(images);
        }
        return null;
    }
}
