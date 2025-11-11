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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity
@Table(name = "product_option_values",
        uniqueConstraints = @UniqueConstraint(name = "uk_pov_option_code", columnNames = {"option_id","value_code"}))
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE product_option_values SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")

public class ProductOptionValue {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "option_id", nullable = false)
    @JsonIgnore
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private ProductOption option;

    @Column(name = "value_code", length = 80)
    private String valueCode;

    @Column(name = "value_label", length = 120)
    private String valueLabel;

    @Column(name = "price_delta", precision = 12, scale = 2)
    private BigDecimal priceDelta;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    /** Usable flag (false => blur + “coming soon”). */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Listable flag (false => hidden entirely). */
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
