package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
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

/**
 * DeliveryFeeRule — per-geo shipping fee rule.
 * scope: DEFAULT / STATE / DISTRICT
 * scopeId: null for DEFAULT, or the referenced states.id / districts.id
 */
@Getter
@Setter
@Entity
@Table(name = "delivery_fee_rules", indexes = {
        @Index(name = "idx_dfr_scope", columnList = "scope"),
        @Index(name = "idx_dfr_scope_scopeid", columnList = "scope, scope_id"),
        @Index(name = "idx_dfr_active", columnList = "active")
})
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE delivery_fee_rules SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
public class DeliveryFeeRules {

    /** Row id. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Rule scope: DEFAULT, STATE, or DISTRICT (stored as VARCHAR). */
    @Enumerated(EnumType.STRING)
    @Column(name = "scope", length = 16, nullable = false)
    private RuleScope scope;

    /** FK to states.id or districts.id depending on scope; null for DEFAULT. */
    @Column(name = "scope_id")
    private Long scopeId;

    /** Fee amount in INR. */
    @Column(name = "fee_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal feeAmount;

    // --- audit / soft-delete ---
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    @Column(name = "created_by", length = 120)
    @CreatedBy
    private String createdBy;

    @Column(name = "created_at")
    @CreatedDate
    private LocalDateTime createdAt;

    @Column(name = "modified_by", length = 120)
    @LastModifiedBy
    private String modifiedBy;

    @Column(name = "modified_at")
    @LastModifiedDate
    private LocalDateTime modifiedAt;

    /** Scope enum matching the VARCHAR values in the DB. */
    public enum RuleScope {
        DEFAULT, STATE, DISTRICT
    }
}
