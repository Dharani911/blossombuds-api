package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Stores one recipient row for a WhatsApp campaign. */
@Getter
@Setter
@Entity
@Table(name = "whatsapp_campaign_recipients")
public class WhatsAppCampaignRecipient {

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

    /** WhatsApp phone number in international format. */
    @Column(name = "phone", nullable = false, length = 30)
    private String phone;

    /** Recipient display name used for template variables. */
    @Column(name = "recipient_name", length = 200)
    private String recipientName;

    /** Recipient send status such as PENDING, QUEUED, SENT, DELIVERED, READ, or FAILED. */
    @Column(name = "status", nullable = false, length = 40)
    private String status = "PENDING";

    /** Message id returned by Meta Cloud API. */
    @Column(name = "provider_message_id", length = 200)
    private String providerMessageId;

    /** Error message captured when sending fails. */
    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    /** JSON string containing template variables for this recipient. */
    @Column(name = "variables_json", columnDefinition = "text")
    private String variablesJson;

    /** Time when this recipient was queued. */
    @Column(name = "queued_at")
    private OffsetDateTime queuedAt;

    /** Time when message was sent. */
    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    /** Time when delivery status was received. */
    @Column(name = "delivered_at")
    private OffsetDateTime deliveredAt;

    /** Time when read status was received. */
    @Column(name = "read_at")
    private OffsetDateTime readAt;

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