package com.blossombuds.repository;

import com.blossombuds.domain.CheckoutIntent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** JPA repository for checkout intents. */
public interface CheckoutIntentRepository extends JpaRepository<CheckoutIntent, Long> {
    Optional<CheckoutIntent> findByRzpOrderId(String rzpOrderId);
}
