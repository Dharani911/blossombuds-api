package com.blossombuds.repository;

import com.blossombuds.domain.PaymentReminder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** Repository for payment reminder notification records. */
public interface PaymentReminderRepository extends JpaRepository<PaymentReminder, Long> {

    /** Finds pending reminders that are due for sending. */
    List<PaymentReminder> findByStatusAndScheduledAtLessThanEqualAndActiveTrueOrderByScheduledAtAsc(
            String status,
            OffsetDateTime scheduledAt
    );

    /** Finds reminders linked to a checkout intent. */
    List<PaymentReminder> findByCheckoutIntentIdAndActiveTrueOrderByCreatedAtDesc(Long checkoutIntentId);

    /** Finds an active reminder by checkout intent, channel, and status. */
    Optional<PaymentReminder> findByCheckoutIntentIdAndChannelAndStatusAndActiveTrue(
            Long checkoutIntentId,
            String channel,
            String status
    );

    /** Finds a payment reminder by provider message id. */
    Optional<PaymentReminder> findByProviderMessageId(String providerMessageId);
}