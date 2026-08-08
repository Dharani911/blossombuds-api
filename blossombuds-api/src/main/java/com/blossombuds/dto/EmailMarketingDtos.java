package com.blossombuds.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/** DTO container for marketing email admin API request and response objects. */
public class EmailMarketingDtos {

    /** Response DTO for email campaign summary. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CampaignResponse {

        /** Campaign database id. */
        private Long id;

        /** Campaign title. */
        private String title;

        /** Email subject line. */
        private String subject;

        /** Email body text. */
        private String bodyText;

        /** Campaign status. */
        private String status;

        /** Total recipient count. */
        private Integer totalRecipients;

        /** Successfully sent count. */
        private Integer sentCount;

        /** Failed count. */
        private Integer failedCount;

        /** Campaign creation time. */
        private OffsetDateTime createdAt;

        /** Campaign completion time. */
        private OffsetDateTime completedAt;
    }

    /** Response DTO for email campaign recipient. */
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

        /** Recipient email address. */
        private String email;

        /** Recipient display name. */
        private String recipientName;

        /** Recipient send status. */
        private String status;

        /** Error message if failed. */
        private String errorMessage;

        /** Time when message was sent. */
        private OffsetDateTime sentAt;

        /** Time when message failed. */
        private OffsetDateTime failedAt;
    }
}
