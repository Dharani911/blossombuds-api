package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Where;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Temporary server-side stash of a checkout draft used to create Order only after payment capture. */
@Entity
@Table(name = "checkout_intent")
@Getter @Setter
@Where(clause = "active = true")
public class CheckoutIntent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id")
    private Long customerId;

    /** Serialized JSON of OrderDto (shipping snapshot etc.). */
    @Column(columnDefinition = "text")
    private String orderDraftJson;

    /** Serialized JSON of List<OrderItemDto>. */
    @Column(columnDefinition = "text")
    private String itemsJson;

    /** Grand total that will be charged (for sanity check). */
    @Column(name = "amount", precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency", length = 8)
    private String currency;

    /** Razorpay order id once created. */
    @Column(name = "rzp_order_id", length = 64)
    private String rzpOrderId;

    /** PENDING / CONVERTED / CANCELLED / EXPIRED */
    @Column(name = "status", length = 16, nullable = false)
    private String status = "PENDING";

    @Column(name = "active", nullable = false)
    private Boolean active = true;

    /** Optional expiry (e.g., 2h). */
    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    // audit
    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "created_by", length = 64) private String createdBy;
    @Column(name = "modified_at") private LocalDateTime modifiedAt;
    @Column(name = "modified_by", length = 64) private String modifiedBy;
}
