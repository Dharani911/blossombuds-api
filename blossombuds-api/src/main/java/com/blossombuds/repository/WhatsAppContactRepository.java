package com.blossombuds.repository;

import com.blossombuds.domain.WhatsAppContact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WhatsAppContactRepository extends JpaRepository<WhatsAppContact, Long> {

    List<WhatsAppContact> findByOptedInTrueAndActiveTrue();

    List<WhatsAppContact> findAllByActiveTrueOrderByCreatedAtDesc();

    Optional<WhatsAppContact> findByPhone(String phone);

    boolean existsByPhone(String phone);
}
