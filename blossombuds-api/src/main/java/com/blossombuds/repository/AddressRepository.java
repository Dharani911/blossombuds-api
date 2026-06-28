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

    /** Dedup check — find an active address with the same physical location for this customer. */
    @Query("""
  select a from Address a
  where a.customer.id = :customerId
    and lower(trim(a.line1)) = lower(trim(:line1))
    and lower(trim(coalesce(a.line2,''))) = lower(trim(coalesce(:line2,'')))
    and lower(trim(a.pincode)) = lower(trim(:pincode))
    and ((:districtId is null and a.district is null) or a.district.id = :districtId)
  order by a.id desc
""")
    List<Address> findActiveByLocation(
            @org.springframework.data.repository.query.Param("customerId") Long customerId,
            @org.springframework.data.repository.query.Param("line1") String line1,
            @org.springframework.data.repository.query.Param("line2") String line2,
            @org.springframework.data.repository.query.Param("pincode") String pincode,
            @org.springframework.data.repository.query.Param("districtId") Long districtId);
}
