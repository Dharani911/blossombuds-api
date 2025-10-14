package com.blossombuds.repository;

import com.blossombuds.domain.Address;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/** Repository for customer addresses. */
public interface AddressRepository extends JpaRepository<Address, Long> {
    /** Lists addresses belonging to a customer id. */
    @Query("""
  select a from Address a
  join fetch a.customer c
  where c.id = :customerId
""")
    List<Address> findByCustomer_Id(Long customerId);
}
