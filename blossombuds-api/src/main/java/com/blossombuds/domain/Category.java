package com.blossombuds.domain;

import com.fasterxml.jackson.annotation.*;
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
import java.util.LinkedHashSet;
import java.util.Set;

/** Represents a hierarchical category for products. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity
@Table(name = "categories")
@EntityListeners(AuditingEntityListener.class) // <-- enable Spring Data auditing
@SQLDelete(sql = "UPDATE {h-schema}categories SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@JsonIgnoreProperties({"hibernateLazyInitializer","handler"}) // safety
public class Category {

    /** Surrogate primary key for categories. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Optional parent category for hierarchy.
     *  Serialize as just the ID to avoid deep graphs & lazy hits. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    @JsonIdentityInfo(generator = ObjectIdGenerators.PropertyGenerator.class, property = "id")
    @JsonIdentityReference(alwaysAsId = true) // <-- parent -> 5 (id only) in JSON
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Category parent;

    /** Human-friendly category name. */
    @Column(length = 100)
    private String name;

    /** Unique slug for routing/lookup. */
    @Column(length = 120, unique = true)
    private String slug;

    @Column(columnDefinition = "text")
    private String description;

    /** Soft-visibility flag to hide/show the category. */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Username/actor who created this record. */
    @CreatedBy
    @Column(name = "created_by", length = 120, updatable = false)
    private String createdBy;

    /** Timestamp when the record was created. */
    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /** Username/actor who last modified this record. */
    @LastModifiedBy
    @Column(name = "modified_by", length = 120)
    private String modifiedBy;

    /** Timestamp when the record was last modified. */
    @LastModifiedDate
    @Column(name = "modified_at")
    private LocalDateTime modifiedAt;

    /** Product links under this category (join rows).
     *  Make sure Jackson NEVER touches this lazy collection. */
    @Getter(AccessLevel.NONE) // don't expose Lombok getter
    @OneToMany(mappedBy = "category", fetch = FetchType.LAZY)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Set<ProductCategory> productLinks = new LinkedHashSet<>();

    @JsonIgnore // explicit ignore at getter level prevents size()/isEmpty() calls
    public Set<ProductCategory> getProductLinks() { return productLinks; }

    public void setProductLinks(Set<ProductCategory> links) { this.productLinks = links; }

    // Optional: convenience read-only scalars for the frontend
    @Transient @JsonProperty("parentId")
    public Long getParentId() { return parent != null ? parent.getId() : null; }

    @Transient @JsonProperty("parentName")
    public String getParentName() { return parent != null ? parent.getName() : null; }
}
