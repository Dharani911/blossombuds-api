package com.blossombuds.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

/** Represents a hierarchical category for products. */
@SQLDelete(sql = "UPDATE categories SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "categories")
public class Category {

    /** Surrogate primary key for categories. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Optional parent category for hierarchy. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    @JsonIgnore
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Category parent;

    /** Human-friendly category name. */
    @Column(length = 100)
    private String name;

    /** Unique slug for routing/lookup. */
    @Column(length = 120, unique = true)
    private String slug;

    /** Soft-visibility flag to hide/show the category. */
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

    /** Product links under this category (join rows). */
    @OneToMany(mappedBy = "category", fetch = FetchType.LAZY)
    @JsonIgnore
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Set<ProductCategory> productLinks = new LinkedHashSet<>();
}
