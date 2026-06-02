package com.blossombuds.repository;

import com.blossombuds.domain.WhatsAppTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for local WhatsApp template records. */
public interface WhatsAppTemplateRepository extends JpaRepository<WhatsAppTemplate, Long> {

    /** Finds active templates ordered by creation time descending. */
    List<WhatsAppTemplate> findByActiveTrueOrderByCreatedAtDesc();

    /** Finds active templates by category. */
    List<WhatsAppTemplate> findByCategoryAndActiveTrueOrderByNameAsc(String category);

    /** Finds a template by Meta provider template name and language code. */
    Optional<WhatsAppTemplate> findByProviderTemplateNameAndLanguageCode(String providerTemplateName, String languageCode);

    /** Finds an active template by id. */
    Optional<WhatsAppTemplate> findByIdAndActiveTrue(Long id);
}