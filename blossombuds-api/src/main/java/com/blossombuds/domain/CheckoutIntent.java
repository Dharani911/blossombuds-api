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

    /** Number of payment reminders already sent for this intent. */
    @Column(name = "reminder_count", nullable = false)
    private Integer reminderCount = 0;

    /** Timestamp of the most recent reminder sent. */
    @Column(name = "reminder_sent_at")
    private LocalDateTime reminderSentAt;

    // audit
    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "created_by", length = 64) private String createdBy;
    @Column(name = "modified_at") private LocalDateTime modifiedAt;
    @Column(name = "modified_by", length = 64) private String modifiedBy;
    /** Sets default values before the checkout intent is first saved. */
    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        modifiedAt = now;

        if (active == null) {
            active = Boolean.TRUE;
        }

        if (status == null || status.isBlank()) {
            status = "PENDING";
        }
    }

    /** Updates modifiedAt whenever the checkout intent changes. */
    @PreUpdate
    public void preUpdate() {
        modifiedAt = LocalDateTime.now();
    }
}
