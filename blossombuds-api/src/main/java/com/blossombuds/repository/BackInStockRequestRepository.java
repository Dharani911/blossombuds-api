package com.blossombuds.repository;

import com.blossombuds.domain.BackInStockRequest;
import com.blossombuds.dto.BackInStockAdminSummaryDto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BackInStockRequestRepository extends JpaRepository<BackInStockRequest, Long> {

    boolean existsByProduct_IdAndCustomer_IdAndActiveTrueAndNotifiedFalse(Long productId, Long customerId);

    boolean existsByProduct_IdAndEmailIgnoreCaseAndActiveTrueAndNotifiedFalse(Long productId, String email);

    List<BackInStockRequest> findByProduct_IdAndActiveTrueAndNotifiedFalse(Long productId);
    @Query("""
    select new com.blossombuds.dto.BackInStockAdminSummaryDto(
        p.id,
        p.name,
        count(s.id),
        min(s.createdAt)
    )
    from BackInStockSubscription s
    join s.product p
    where s.active = true
      and p.active = true
      and p.visible = true
      and p.inStock = false
    group by p.id, p.name
    order by min(s.createdAt) asc
""")
    List<BackInStockAdminSummaryDto> findAdminSummaryForOutOfStockProducts();
}