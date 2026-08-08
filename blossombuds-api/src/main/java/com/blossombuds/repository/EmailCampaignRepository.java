package com.blossombuds.repository;

import com.blossombuds.domain.EmailCampaign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for marketing email campaigns. */
public interface EmailCampaignRepository extends JpaRepository<EmailCampaign, Long> {

    /** Lists all active campaigns newest first (admin UI). */
    List<EmailCampaign> findByActiveTrueOrderByCreatedAtDesc();

    /** Finds an active campaign by id. */
    Optional<EmailCampaign> findByIdAndActiveTrue(Long id);
}
