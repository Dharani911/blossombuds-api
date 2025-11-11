package com.blossombuds.domain;

import com.blossombuds.db.GenericPgEnumConverter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcType;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Payment record associated with an order (Razorpay snapshots included). */
@SQLDelete(sql = "UPDATE payments SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@Entity @Table(name = "payments")
public class Payment {

    /** Surrogate primary key for payments. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Owning order for this payment. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Order order;

    /** Payment lifecycle state (PostgreSQL enum: payment_status_enum). */
    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(name = "status", columnDefinition = "payment_status_enum")
    private PaymentStatus status;

    /** Amount authorized/captured. */
    @Column(name = "amount", precision = 12, scale = 2)
    private BigDecimal amount;

    /** ISO currency code (e.g., INR). */
    @Column(name = "currency", length = 3)
    private String currency;

    /** Razorpay order id snapshot. */
    @Column(name = "rzp_order_id", length = 100)
    private String rzpOrderId;

    /** Razorpay payment id snapshot. */
    @Column(name = "rzp_payment_id", length = 100)
    private String rzpPaymentId;

    /** Soft-visibility flag for this payment. */
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

    /** Timestamp when the record was last modified. */
    @Column(name = "modified_at")
    @LastModifiedDate
    private LocalDateTime modifiedAt;
}
