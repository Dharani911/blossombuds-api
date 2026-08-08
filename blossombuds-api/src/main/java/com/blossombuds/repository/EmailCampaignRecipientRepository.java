package com.blossombuds.repository;

import com.blossombuds.domain.EmailCampaignRecipient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Repository for email campaign recipient rows. */
public interface EmailCampaignRecipientRepository extends JpaRepository<EmailCampaignRecipient, Long> {

    /** Finds all active recipients for a campaign. */
    List<EmailCampaignRecipient> findByCampaignIdAndActiveTrueOrderByCreatedAtAsc(Long campaignId);

    /** Finds active recipients for a campaign by status. */
    List<EmailCampaignRecipient> findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(Long campaignId, String status);

    /** Finds active recipients by status for queue processing (crash recovery). */
    List<EmailCampaignRecipient> findByStatusAndActiveTrueOrderByCreatedAtAsc(String status);

    /** Counts recipients for a campaign by status. */
    long countByCampaignIdAndStatusAndActiveTrue(Long campaignId, String status);

    /** Counts all active recipients for a campaign. */
    long countByCampaignIdAndActiveTrue(Long campaignId);
}
