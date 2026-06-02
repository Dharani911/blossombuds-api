package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Stores raw WhatsApp webhook message events for audit and troubleshooting. */
@Getter
@Setter
@Entity
@Table(name = "whatsapp_message_events")
public class WhatsAppMessageEvent {

    /** Unique event identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Message id received from Meta Cloud API. */
    @Column(name = "provider_message_id", length = 200)
    private String providerMessageId;

    /** Sender or recipient phone number associated with the event. */
    @Column(name = "phone", length = 30)
    private String phone;

    /** Internal event type such as STATUS, MESSAGE, or ERROR. */
    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    /** Provider status such as sent, delivered, read, or failed. */
    @Column(name = "provider_status", length = 50)
    private String providerStatus;

    /** Raw webhook payload stored for debugging. */
    @Column(name = "raw_payload", columnDefinition = "text")
    private String rawPayload;

    /** Provider error code, if available. */
    @Column(name = "error_code", length = 100)
    private String errorCode;

    /** Provider error message, if available. */
    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    /** Time when webhook was received. */
    @Column(name = "received_at", nullable = false)
    private OffsetDateTime receivedAt = OffsetDateTime.now();

    /** Record creation time. */
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}