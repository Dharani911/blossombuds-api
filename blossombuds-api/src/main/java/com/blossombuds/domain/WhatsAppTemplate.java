package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Stores a local reference to an approved Meta WhatsApp message template. */
@Getter
@Setter
@Entity
@Table(name = "whatsapp_templates")
public class WhatsAppTemplate {

    /** Unique template identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Internal display name for admin users. */
    @Column(name = "name", nullable = false, length = 150)
    private String name;

    /** Exact template name registered in Meta WhatsApp Manager. */
    @Column(name = "provider_template_name", nullable = false, length = 150)
    private String providerTemplateName;

    /** Template category such as MARKETING, UTILITY, or AUTHENTICATION. */
    @Column(name = "category", nullable = false, length = 30)
    private String category;

    /** Template language code used by Meta. */
    @Column(name = "language_code", nullable = false, length = 20)
    private String languageCode = "en";

    /** Preview text shown in the admin panel. */
    @Column(name = "body_preview", columnDefinition = "text")
    private String bodyPreview;

    /** Number of variables expected by the template. */
    @Column(name = "variable_count", nullable = false)
    private Integer variableCount = 0;

    /** Whether this template can be used for campaigns. */
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