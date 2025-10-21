package com.blossombuds.repository;

import com.blossombuds.domain.DeliveryPartner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for delivery partners. */
public interface DeliveryPartnerRepository extends JpaRepository<DeliveryPartner, Long> {



    Optional<DeliveryPartner> findByCode(String code);


    /** Lists all active partners. */
    List<DeliveryPartner> findByActiveTrue();
}
