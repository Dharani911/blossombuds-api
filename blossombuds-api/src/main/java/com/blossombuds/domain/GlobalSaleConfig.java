package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Global sale/discount configuration (supports multiple rows; choose the active one by rules in service). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(
        name = "global_sale_config",
        indexes = {
                @Index(name = "idx_global_sale_enabled", columnList = "enabled")
        }
)
public class GlobalSaleConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Master toggle. If false, this row is ignored. */
    @Column(nullable = false)
    private Boolean enabled = Boolean.FALSE;

    /** Percentage off (e.g., 10.00 means 10% off). */
    @Column(name = "percent_off", precision = 5, scale = 2, nullable = false)
    private BigDecimal percentOff = BigDecimal.ZERO;

    /** Optional label for admin/UI (e.g., "New Year Sale"). */
    @Column(length = 120)
    private String label;

    /** Optional time window start. */
    @Column(name = "starts_at")
    private LocalDateTime startsAt;

    /** Optional time window end. */
    @Column(name = "ends_at")
    private LocalDateTime endsAt;

    /** Created timestamp (DB default CURRENT_TIMESTAMP). */
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Modified timestamp (DB default CURRENT_TIMESTAMP; update in service or DB trigger). */
    @Column(name = "modified_at", nullable = false)
    @LastModifiedDate
    private LocalDateTime modifiedAt;
}
