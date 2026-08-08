package com.blossombuds.repository;

import com.blossombuds.domain.WhatsAppContact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WhatsAppContactRepository extends JpaRepository<WhatsAppContact, Long> {

    List<WhatsAppContact> findByOptedInTrueAndActiveTrue();

    /** Contacts who have messaged the business number — the ones marketing can actually reach. */
    List<WhatsAppContact> findByOptedInTrueAndActiveTrueAndLastInboundAtIsNotNull();

    long countByOptedInTrueAndActiveTrueAndLastInboundAtIsNotNull();

    long countByOptedInTrueAndActiveTrue();

    List<WhatsAppContact> findAllByActiveTrueOrderByCreatedAtDesc();

    Optional<WhatsAppContact> findByPhone(String phone);

    boolean existsByPhone(String phone);
}
