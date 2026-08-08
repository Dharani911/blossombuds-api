package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Stores a marketing email campaign header and delivery summary counts.
 *  Audience is always the same fixed rule (customers with no phone on file, not unsubscribed) —
 *  there is no per-campaign audience-type selection, unlike the WhatsApp campaign system. */
@Getter
@Setter
@Entity
@Table(name = "email_campaigns")
public class EmailCampaign {

    /** Unique campaign identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Admin-facing campaign title. */
    @Column(name = "title", nullable = false, length = 200)
    private String title;

    /** Email subject line. */
    @Column(name = "subject", nullable = false, length = 200)
    private String subject;

    /** Email body, using the same [label](url) link-marker convention as other outgoing emails. */
    @Column(name = "body_text", nullable = false, columnDefinition = "text")
    private String bodyText;

    /** Campaign status such as DRAFT, SENDING, COMPLETED, PARTIAL, or FAILED. */
    @Column(name = "status", nullable = false, length = 40)
    private String status = "DRAFT";

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
