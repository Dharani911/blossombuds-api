package com.blossombuds.repository;

import com.blossombuds.domain.DeliveryRegion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeliveryRegionRepository extends JpaRepository<DeliveryRegion, Long> {

    List<DeliveryRegion> findByActiveTrueOrderByNameAsc();

    /** Returns IDs of active regions that contain the given stateId. */
    @Query("SELECT DISTINCT dr.id FROM DeliveryRegion dr JOIN dr.stateIds sid WHERE sid = :stateId AND dr.active = true")
    List<Long> findActiveRegionIdsByStateId(@Param("stateId") Long stateId);
}
