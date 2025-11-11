package com.blossombuds.domain;

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

/** Per-product option definition (e.g., Size, Color). */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity
@Table(name = "product_options")
@EntityListeners(AuditingEntityListener.class)

@SQLDelete(sql = "UPDATE product_options SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true") // visible rows load; active=false still returned for blur

public class ProductOption {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnore
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Product product;

    @Column(name = "name", length = 80)
    private String name;

    @Column(name = "input_type", length = 20)
    private String inputType;

    /** Required at checkout? */
    @Column(name = "is_required", nullable = false)
    private Boolean required = Boolean.TRUE;

    @Column(name = "max_select")
    private Short maxSelect;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    /** Buyable/usable flag for the option (but still visible). */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Listable flag for the option. */
    @Column(nullable = false)
    private Boolean visible = Boolean.TRUE;

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
