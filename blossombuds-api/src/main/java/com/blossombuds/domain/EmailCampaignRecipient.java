package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Stores one recipient row for a marketing email campaign. */
@Getter
@Setter
@Entity
@Table(name = "email_campaign_recipients")
public class EmailCampaignRecipient {

    /** Unique campaign recipient identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Campaign to which this recipient belongs. */
    @Column(name = "campaign_id", nullable = false)
    private Long campaignId;

    /** Customer linked to this recipient, if available. */
    @Column(name = "customer_id")
    private Long customerId;

    /** Email address this recipient row sends to. */
    @Column(name = "email", nullable = false, length = 320)
    private String email;

    /** Recipient display name used for the email greeting. */
    @Column(name = "recipient_name", length = 200)
    private String recipientName;

    /** Recipient send status such as PENDING, SENDING, SENT, or FAILED. */
    @Column(name = "status", nullable = false, length = 40)
    private String status = "PENDING";

    /** Error message captured when sending fails. */
    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    /** Time when message was sent. */
    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    /** Time when failure occurred. */
    @Column(name = "failed_at")
    private OffsetDateTime failedAt;

    /** Whether this recipient record is active. */
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
