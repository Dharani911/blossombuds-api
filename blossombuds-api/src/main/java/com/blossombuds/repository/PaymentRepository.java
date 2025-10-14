package com.blossombuds.repository;

import com.blossombuds.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for payments. */
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    /** Lists all payments for an order id. */
    List<Payment> findByOrder_Id(Long orderId);
    Optional<Payment> findByRzpPaymentId(String rzpPaymentId);
}
