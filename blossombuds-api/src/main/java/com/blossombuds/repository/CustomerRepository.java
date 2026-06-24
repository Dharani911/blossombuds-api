package com.blossombuds.repository;

import com.blossombuds.domain.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Repository for customers (active-only by @Where in entity). */
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByEmail(String email);
    List<Customer> findByNameContainingIgnoreCase(String name);
    Optional<Customer> findByGoogleSubject(String googleSubject);
    Optional<Customer> findByPhone(String phone);

    /** Returns the set of non-null, non-blank phones for all registered customers. */
    @Query("select c.phone from Customer c where c.phone is not null and c.phone <> ''")
    Set<String> findAllRegisteredPhones();
}
