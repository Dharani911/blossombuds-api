package com.blossombuds.repository;

import com.blossombuds.domain.District;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DistrictRepository extends JpaRepository<District,Long> {
    List<District> findByStateId(Long stateId);
}
