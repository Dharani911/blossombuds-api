package com.blossombuds.repository;

import com.blossombuds.domain.BackInStockRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BackInStockRequestRepository extends JpaRepository<BackInStockRequest, Long> {

    boolean existsByProduct_IdAndCustomer_IdAndActiveTrueAndNotifiedFalse(Long productId, Long customerId);

    boolean existsByProduct_IdAndEmailIgnoreCaseAndActiveTrueAndNotifiedFalse(Long productId, String email);

    List<BackInStockRequest> findByProduct_IdAndActiveTrueAndNotifiedFalse(Long productId);
}