package com.blossombuds.repository;

import com.blossombuds.domain.CustomerEmailPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for customer marketing-email opt-out preferences. */
public interface CustomerEmailPreferenceRepository extends JpaRepository<CustomerEmailPreference, Long> {

    /** Finds a preference row by customer id. */
    Optional<CustomerEmailPreference> findByCustomerId(Long customerId);

    /** Finds a preference row by its public unsubscribe token. */
    Optional<CustomerEmailPreference> findByUnsubscribeToken(String unsubscribeToken);

    /** Finds all customers who have unsubscribed, for excluding from campaign audiences. */
    List<CustomerEmailPreference> findByUnsubscribedTrue();
}
