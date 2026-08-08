package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Stores a customer's marketing-email opt-out state. Opt-out model: a customer is
 *  eligible for marketing email by default unless they've unsubscribed. */
@Getter
@Setter
@Entity
@Table(name = "customer_email_preferences")
public class CustomerEmailPreference {

    /** Unique preference identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Customer who owns this email preference. */
    @Column(name = "customer_id")
    private Long customerId;

    /** Email address marketing sends go to. */
    @Column(name = "email", nullable = false, length = 320)
    private String email;

    /** Whether the customer has unsubscribed from marketing email. */
    @Column(name = "unsubscribed", nullable = false)
    private Boolean unsubscribed = Boolean.FALSE;

    /** Time when the customer unsubscribed. */
    @Column(name = "unsubscribed_at")
    private OffsetDateTime unsubscribedAt;

    /** One-click unsubscribe link token. */
    @Column(name = "unsubscribe_token", nullable = false, length = 64)
    private String unsubscribeToken;

    /** Whether this preference record is active. */
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
