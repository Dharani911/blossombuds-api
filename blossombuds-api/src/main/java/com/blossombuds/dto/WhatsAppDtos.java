package com.blossombuds.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/** DTO container for WhatsApp CRM admin API request and response objects. */
public class WhatsAppDtos {

    /** Response DTO for WhatsApp templates. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TemplateResponse {

        /** Template database id. */
        private Long id;

        /** Template display name. */
        private String name;

        /** Exact Meta template name. */
        private String providerTemplateName;

        /** Template category. */
        private String category;

        /** Template language code. */
        private String languageCode;

        /** Preview of template body. */
        private String bodyPreview;

        /** Number of template variables. */
        private Integer variableCount;

        /** Whether the template is active. */
        private Boolean active;
    }

    /** Response DTO for WhatsApp campaign summary. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CampaignResponse {

        /** Campaign database id. */
        private Long id;

        /** Campaign title. */
        private String title;

        /** Template id used by this campaign. */
        private Long templateId;

        /** Audience type used by this campaign. */
        private String audienceType;

        /** Campaign status. */
        private String status;

        /** Total recipient count. */
        private Integer totalRecipients;

        /** Successfully sent count. */
        private Integer sentCount;

        /** Failed count. */
        private Integer failedCount;

        /** Delivered count from webhook. */
        private Integer deliveredCount;

        /** Read count from webhook. */
        private Integer readCount;

        /** Campaign notes. */
        private String notes;

        /** Campaign creation time. */
        private OffsetDateTime createdAt;

        /** Campaign completion time. */
        private OffsetDateTime completedAt;
    }

    /** Response DTO for WhatsApp campaign recipient. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecipientResponse {

        /** Recipient database id. */
        private Long id;

        /** Campaign id linked to this recipient. */
        private Long campaignId;

        /** Linked customer id if available. */
        private Long customerId;

        /** Recipient phone number. */
        private String phone;

        /** Recipient display name. */
        private String recipientName;

        /** Recipient send status. */
        private String status;

        /** Provider message id or dry-run id. */
        private String providerMessageId;

        /** Error message if failed. */
        private String errorMessage;

        /** Time when message was sent. */
        private OffsetDateTime sentAt;

        /** Time when message failed. */
        private OffsetDateTime failedAt;
    }
}