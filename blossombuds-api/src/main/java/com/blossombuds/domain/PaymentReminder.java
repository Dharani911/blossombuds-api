package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Tracks payment reminder notifications for incomplete checkout/payment attempts. */
@Getter
@Setter
@Entity
@Table(name = "payment_reminders")
public class PaymentReminder {

    /** Unique payment reminder identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Checkout intent associated with the pending payment. */
    @Column(name = "checkout_intent_id", nullable = false)
    private Long checkoutIntentId;

    /** Customer linked to this reminder, if available. */
    @Column(name = "customer_id")
    private Long customerId;

    /** Reminder channel such as EMAIL or WHATSAPP. */
    @Column(name = "channel", nullable = false, length = 30)
    private String channel;

    /** WhatsApp phone number used for this reminder. */
    @Column(name = "phone", length = 30)
    private String phone;

    /** Email address used for this reminder. */
    @Column(name = "email", length = 255)
    private String email;

    /** Reminder status such as PENDING, SENT, FAILED, or CANCELLED. */
    @Column(name = "status", nullable = false, length = 40)
    private String status = "PENDING";

    /** Message id returned by external provider, if available. */
    @Column(name = "provider_message_id", length = 200)
    private String providerMessageId;

    /** Failure details when reminder fails. */
    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    /** Time when reminder should be sent. */
    @Column(name = "scheduled_at", nullable = false)
    private OffsetDateTime scheduledAt;

    /** Time when reminder was sent. */
    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    /** Time when reminder failed. */
    @Column(name = "failed_at")
    private OffsetDateTime failedAt;

    /** Whether this reminder record is active. */
    @Column(name = "active", nullable = false)
    private Boolean active = Boolean.TRUE;

    /** User/system that created this record. */
    @Column(name = "created_by", length = 100)
    private String createdBy;

    /** Record creation time. */
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    /** User/system that last modified this record. */
    @Column(name = "modified_by", length = 100)
    private String modifiedBy;

    /** Last modification time. */
    @Column(name = "modified_at", nullable = false)
    private OffsetDateTime modifiedAt = OffsetDateTime.now();
}