package com.blossombuds.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.OffsetDateTime;

/** Per-product option definition (e.g., Length, Clip Type, Colors). */
@SQLDelete(sql = "UPDATE product_options SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "product_options")
public class ProductOption {

    /** Surrogate primary key. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Owning product. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnore
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Product product;

    /** Option display name. */
    @Column(name = "name", length = 80)
    private String name;

    /** select | multiselect | text (per spec). */
    @Column(name = "input_type", length = 20)
    private String inputType;

    /** Whether selection is required. */
    @Column(name = "is_required", nullable = false)
    private Boolean required = Boolean.TRUE;

    /** Max selections (for multiselect). */
    @Column(name = "max_select")
    private Short maxSelect;

    /** Ordering among options. */
    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    /** Soft-visibility flag. */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Audit. */
    @Column(name = "created_by", length = 120) private String createdBy;
    @Column(name = "created_at") private OffsetDateTime createdAt;
    @Column(name = "modified_by", length = 120) private String modifiedBy;
    @Column(name = "modified_at") private OffsetDateTime modifiedAt;
}
