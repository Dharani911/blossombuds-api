package com.blossombuds.repository;

import com.blossombuds.domain.CustomerWhatsAppPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for customer WhatsApp opt-in and opt-out preferences. */
public interface CustomerWhatsAppPreferenceRepository extends JpaRepository<CustomerWhatsAppPreference, Long> {

    /** Finds a WhatsApp preference by customer id. */
    Optional<CustomerWhatsAppPreference> findByCustomerId(Long customerId);

    /** Finds an active opted-in WhatsApp preference by customer id. */
    Optional<CustomerWhatsAppPreference> findByCustomerIdAndOptedInTrueAndActiveTrue(Long customerId);

    /** Finds all active customers who opted in to WhatsApp communication. */
    List<CustomerWhatsAppPreference> findByOptedInTrueAndActiveTrue();

    /** Finds a WhatsApp preference by phone number. */
    Optional<CustomerWhatsAppPreference> findByPhoneAndActiveTrue(String phone);

    /** Finds active WhatsApp preferences ordered by latest first. */
    List<CustomerWhatsAppPreference> findByActiveTrueOrderByCreatedAtDesc();
}