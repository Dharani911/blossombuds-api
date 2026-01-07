package com.blossombuds.repository;

import com.blossombuds.domain.CheckoutIntent;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.Optional;

/** JPA repository for checkout intents. */
public interface CheckoutIntentRepository extends CrudRepository<CheckoutIntent, Long> {

    /** Finds an intent by Razorpay order id. */
    Optional<CheckoutIntent> findByRzpOrderId(String rzpOrderId);

    /** Finds an intent by Razorpay order id with a row lock to prevent double conversion. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select ci from CheckoutIntent ci where ci.rzpOrderId = :rzpOrderId")
    Optional<CheckoutIntent> findForUpdateByRzpOrderId(String rzpOrderId);
}
