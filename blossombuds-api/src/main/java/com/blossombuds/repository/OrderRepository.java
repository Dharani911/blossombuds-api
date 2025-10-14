package com.blossombuds.repository;

import com.blossombuds.domain.Order;
import com.blossombuds.domain.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for reading/writing orders. */
public interface OrderRepository extends JpaRepository<Order, Long> {

    /** Finds an order by its 6-char public code (YYNNNN). */
    Optional<Order> findByPublicCode(String publicCode);

    /** Lists orders for a customer, newest first. */
    List<Order> findByCustomerIdOrderByIdDesc(Long customerId);

    /** Lists orders by status, newest first. */
    List<Order> findByStatusOrderByIdDesc(OrderStatus status);
}
