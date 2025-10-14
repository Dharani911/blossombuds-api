package com.blossombuds.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Value under a product option (e.g., L24, Gold Clip, Red). */
@SQLDelete(sql = "UPDATE product_option_values SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "product_option_values",
        uniqueConstraints = @UniqueConstraint(name = "uk_pov_option_code", columnNames = {"option_id","value_code"}))
public class ProductOptionValue {

    /** Surrogate primary key. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Parent option. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "option_id", nullable = false)
    @JsonIgnore
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private ProductOption option;

    /** Internal key (e.g., L24). */
    @Column(name = "value_code", length = 80)
    private String valueCode;

    /** Display label. */
    @Column(name = "value_label", length = 120)
    private String valueLabel;

    /** Optional surcharge (default 0). */
    @Column(name = "price_delta", precision = 12, scale = 2)
    private BigDecimal priceDelta;

    /** Value sort order. */
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
