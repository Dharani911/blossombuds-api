package com.blossombuds.repository;

import com.blossombuds.domain.WhatsAppCampaignRecipient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for WhatsApp campaign recipient rows. */
public interface WhatsAppCampaignRecipientRepository extends JpaRepository<WhatsAppCampaignRecipient, Long> {

    /** Finds all active recipients for a campaign. */
    List<WhatsAppCampaignRecipient> findByCampaignIdAndActiveTrueOrderByCreatedAtAsc(Long campaignId);

    /** Finds active recipients for a campaign by status. */
    List<WhatsAppCampaignRecipient> findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(Long campaignId, String status);

    /** Finds active recipients by status for queue processing. */
    List<WhatsAppCampaignRecipient> findByStatusAndActiveTrueOrderByCreatedAtAsc(String status);

    /** Finds a recipient row by provider message id. */
    Optional<WhatsAppCampaignRecipient> findByProviderMessageId(String providerMessageId);

    /** Counts recipients for a campaign by status. */
    long countByCampaignIdAndStatusAndActiveTrue(Long campaignId, String status);

    /** Counts all active recipients for a campaign. */
    long countByCampaignIdAndActiveTrue(Long campaignId);
}