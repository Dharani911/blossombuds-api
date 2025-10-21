package com.blossombuds.repository;

import com.blossombuds.domain.Address;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

/** Repository for customer addresses. */
public interface AddressRepository extends JpaRepository<Address, Long> {
    /** Lists addresses belonging to a customer id. */
    @Query("""
  select a from Address a
  join fetch a.customer c
  where c.id = :customerId
""")
    List<Address> findByCustomer_Id(Long customerId);
    boolean existsByCustomer_IdAndActiveTrue(Long customerId);

    // Or with count (use >0 in service)
    long countByCustomer_IdAndActiveTrue(Long customerId);

    // Handy when you want the current default
    Optional<Address> findFirstByCustomer_IdAndIsDefaultTrueAndActiveTrue(Long customerId);
}
