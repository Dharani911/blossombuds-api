package com.blossombuds.repository;

import com.blossombuds.domain.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for customers (active-only by @Where in entity). */
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByEmail(String email);
    List<Customer> findByNameContainingIgnoreCase(String name);
    Optional<Customer> findByGoogleSubject(String googleSubject);
    Optional<Customer> findByPhone(String phone);

}
