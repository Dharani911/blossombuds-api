package com.blossombuds.repository;

import com.blossombuds.domain.StatePartnerAllowlist;
import com.blossombuds.domain.StatePartnerAllowlist.StatePartnerAllowlistId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StatePartnerAllowlistRepository extends JpaRepository<StatePartnerAllowlist, StatePartnerAllowlistId> {

    /** True when a state has any allowlist restrictions configured. */
    boolean existsByIdStateId(Long stateId);

    /** Partner IDs allowed for a given state. */
    @Query("SELECT spa.id.deliveryPartnerId FROM StatePartnerAllowlist spa WHERE spa.id.stateId = :stateId")
    List<Long> findPartnerIdsByStateId(@Param("stateId") Long stateId);

    /** All entries for a given state (for admin display). */
    List<StatePartnerAllowlist> findByIdStateId(Long stateId);

    /** Remove all entries for a state (used when resetting a state's allowlist). */
    void deleteByIdStateId(Long stateId);
}
