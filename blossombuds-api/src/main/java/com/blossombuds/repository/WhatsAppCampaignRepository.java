package com.blossombuds.repository;

import com.blossombuds.domain.WhatsAppCampaign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for WhatsApp campaign headers. */
public interface WhatsAppCampaignRepository extends JpaRepository<WhatsAppCampaign, Long> {

    /** Finds active campaigns ordered by creation time descending. */
    List<WhatsAppCampaign> findByActiveTrueOrderByCreatedAtDesc();

    /** Finds active campaigns by status. */
    List<WhatsAppCampaign> findByStatusAndActiveTrueOrderByCreatedAtAsc(String status);

    /** Finds an active campaign by id. */
    Optional<WhatsAppCampaign> findByIdAndActiveTrue(Long id);
}