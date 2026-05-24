package com.blossombuds.repository;

import com.blossombuds.domain.CheckoutIntent;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.domain.Pageable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/** JPA repository for checkout intents. */
public interface CheckoutIntentRepository extends JpaRepository<CheckoutIntent, Long> {

    /** Finds an intent by Razorpay order id. */
    Optional<CheckoutIntent> findByRzpOrderId(String rzpOrderId);

    /** Finds an intent by Razorpay order id with a row lock to prevent double conversion. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select ci from CheckoutIntent ci where ci.rzpOrderId = :rzpOrderId")
    Optional<CheckoutIntent> findForUpdateByRzpOrderId(String rzpOrderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select ci from CheckoutIntent ci where ci.id = :id")
    Optional<CheckoutIntent> findForUpdateById(Long id);
    List<CheckoutIntent> findTop100ByStatusInAndActiveTrueOrderByIdAsc(List<String> statuses);
    @Query("""
        select ci
        from CheckoutIntent ci
        where ci.status = :status
          and ci.active = true
          and ci.rzpOrderId is not null
          and ci.rzpOrderId <> ''
          and ci.createdAt >= :startTime
          and ci.createdAt <= :safeUpperTime
        order by ci.createdAt asc
        """)
    List<CheckoutIntent> findPendingForReconciliation(
            String status,
            LocalDateTime startTime,
            LocalDateTime safeUpperTime,
            Pageable pageable
    );
}
