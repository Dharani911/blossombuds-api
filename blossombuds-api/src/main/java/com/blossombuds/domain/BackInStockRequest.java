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

import java.time.LocalDateTime;

/** Back-in-stock email request for a product. */
@Getter
@Setter
@Entity
@Table(
        name = "back_in_stock_requests",
        indexes = {
                @Index(name = "idx_bisr_product_id", columnList = "product_id"),
                @Index(name = "idx_bisr_customer_id", columnList = "customer_id"),
                @Index(name = "idx_bisr_email", columnList = "email"),
                @Index(name = "idx_bisr_pending_lookup", columnList = "product_id, active, notified"),
                @Index(name = "idx_bisr_customer_pending", columnList = "product_id, customer_id, active, notified"),
                @Index(name = "idx_bisr_email_pending", columnList = "product_id, email, active, notified")
        }
)
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE {h-schema}back_in_stock_requests SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
public class BackInStockRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @Column(nullable = false, length = 320)
    private String email;

    @Column(nullable = false)
    private Boolean notified = Boolean.FALSE;

    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    @Column(name = "notified_at")
    private LocalDateTime notifiedAt;

    @CreatedBy
    @Column(name = "created_by", length = 120)
    private String createdBy;

    @CreatedDate
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @LastModifiedBy
    @Column(name = "modified_by", length = 120)
    private String modifiedBy;

    @LastModifiedDate
    @Column(name = "modified_at")
    private LocalDateTime modifiedAt;
}