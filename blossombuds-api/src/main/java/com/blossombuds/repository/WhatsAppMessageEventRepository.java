package com.blossombuds.repository;

import com.blossombuds.domain.WhatsAppMessageEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for WhatsApp webhook and message status events. */
public interface WhatsAppMessageEventRepository extends JpaRepository<WhatsAppMessageEvent, Long> {

    /** Finds events by Meta provider message id ordered by receive time descending. */
    List<WhatsAppMessageEvent> findByProviderMessageIdOrderByReceivedAtDesc(String providerMessageId);

    /** Finds recent events by phone number. */
    List<WhatsAppMessageEvent> findTop50ByPhoneOrderByReceivedAtDesc(String phone);

    /** Resolves a wamid back to the transactional send that produced it, so an incoming delivery
     *  status can be attributed to a template (order_confirmation, order_dispatched, …). */
    Optional<WhatsAppMessageEvent> findFirstByProviderMessageIdAndEventType(String providerMessageId,
                                                                           String eventType);
}