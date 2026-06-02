package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Stores a WhatsApp campaign header and delivery summary counts. */
@Getter
@Setter
@Entity
@Table(name = "whatsapp_campaigns")
public class WhatsAppCampaign {

    /** Unique campaign identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Admin-facing campaign title. */
    @Column(name = "title", nullable = false, length = 200)
    private String title;

    /** Template used by this campaign. */
    @Column(name = "template_id", nullable = false)
    private Long templateId;

    /** Audience type such as ALL_OPTED_IN, MANUAL, or RECENT_CUSTOMERS. */
    @Column(name = "audience_type", nullable = false, length = 50)
    private String audienceType;

    /** Campaign status such as DRAFT, QUEUED, SENDING, SENT, or FAILED. */
    @Column(name = "status", nullable = false, length = 40)
    private String status = "DRAFT";

    /** Optional scheduled send time. */
    @Column(name = "scheduled_at")
    private OffsetDateTime scheduledAt;

    /** Time when sending started. */
    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    /** Time when sending completed. */
    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    /** Total recipients added to this campaign. */
    @Column(name = "total_recipients", nullable = false)
    private Integer totalRecipients = 0;

    /** Number of recipients sent successfully. */
    @Column(name = "sent_count", nullable = false)
    private Integer sentCount = 0;

    /** Number of recipients failed. */
    @Column(name = "failed_count", nullable = false)
    private Integer failedCount = 0;

    /** Number of delivered webhook statuses received. */
    @Column(name = "delivered_count", nullable = false)
    private Integer deliveredCount = 0;

    /** Number of read webhook statuses received. */
    @Column(name = "read_count", nullable = false)
    private Integer readCount = 0;

    /** Internal notes for admin users. */
    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    /** Whether this campaign record is active. */
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