package com.blossombuds.repository;

import com.blossombuds.domain.WhatsAppMessageEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Repository for WhatsApp webhook and message status events. */
public interface WhatsAppMessageEventRepository extends JpaRepository<WhatsAppMessageEvent, Long> {

    /** Finds events by Meta provider message id ordered by receive time descending. */
    List<WhatsAppMessageEvent> findByProviderMessageIdOrderByReceivedAtDesc(String providerMessageId);

    /** Finds recent events by phone number. */
    List<WhatsAppMessageEvent> findTop50ByPhoneOrderByReceivedAtDesc(String phone);
}