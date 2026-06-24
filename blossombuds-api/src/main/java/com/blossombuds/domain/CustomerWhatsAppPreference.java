package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Stores a customer's WhatsApp opt-in or opt-out preference. */
@Getter
@Setter
@Entity
@Table(name = "customer_whatsapp_preferences")
public class CustomerWhatsAppPreference {

    /** Unique preference identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Customer who owns this WhatsApp preference. */
    @Column(name = "customer_id")
    private Long customerId;

    /** WhatsApp phone number in international format without spaces. */
    @Column(name = "phone", nullable = false, length = 30)
    private String phone;

    /** Whether the customer has opted in to WhatsApp communication. */
    @Column(name = "opted_in", nullable = false)
    private Boolean optedIn = Boolean.FALSE;

    /** Source where the consent was captured, such as CHECKOUT, PROFILE, or ADMIN. */
    @Column(name = "source", length = 50)
    private String source;

    /** Time when the customer opted in. */
    @Column(name = "opted_in_at")
    private OffsetDateTime optedInAt;

    /** Time when the customer opted out of WhatsApp. */
    @Column(name = "opted_out_at")
    private OffsetDateTime optedOutAt;

    /** Whether the customer has opted in to SMS notifications. */
    @Column(name = "sms_opted_in", nullable = false)
    private Boolean smsOptedIn = Boolean.FALSE;

    /** Time when the customer opted in to SMS. */
    @Column(name = "sms_opted_in_at")
    private OffsetDateTime smsOptedInAt;

    /** Time when the customer opted out of SMS. */
    @Column(name = "sms_opted_out_at")
    private OffsetDateTime smsOptedOutAt;

    /** Last consent text shown to the customer. */
    @Column(name = "last_consent_text", columnDefinition = "text")
    private String lastConsentText;

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