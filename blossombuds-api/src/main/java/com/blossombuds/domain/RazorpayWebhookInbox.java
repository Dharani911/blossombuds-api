package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "razorpay_webhook_inbox", indexes = {
        @Index(name = "idx_rzp_webhook_status", columnList = "status"),
        @Index(name = "idx_rzp_webhook_event", columnList = "eventType"),
        @Index(name = "idx_rzp_webhook_payment", columnList = "rzpPaymentId"),
        @Index(name = "idx_rzp_webhook_order", columnList = "rzpOrderId")
})
public class RazorpayWebhookInbox {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "environment", length = 20, nullable = false)
    private String environment;

    @Column(name = "event_type", length = 80, nullable = false)
    private String eventType;

    @Column(name = "rzp_order_id", length = 80)
    private String rzpOrderId;

    @Column(name = "rzp_payment_id", length = 80)
    private String rzpPaymentId;

    @Lob
    @Column(name = "payload_json", nullable = false)
    private String payloadJson;

    @Column(name = "status", length = 20, nullable = false)
    private String status; // NEW, PROCESSING, DONE, FAILED

    @Column(name = "attempt_count", nullable = false)
    private Integer attemptCount = 0;

    @Column(name = "last_error", length = 1000)
    private String lastError;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;
}