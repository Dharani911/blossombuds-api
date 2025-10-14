package com.blossombuds.repository;

import com.blossombuds.domain.OrderEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Repository for order events. */
public interface OrderEventRepository extends JpaRepository<OrderEvent, Long> {
    /** Lists events for an order id ordered by creation time. */
    List<OrderEvent> findByOrder_IdOrderByCreatedAtAsc(Long orderId);
}
