package com.blossombuds.repository;

import com.blossombuds.domain.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Repository for order items. */
public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {
    /** Lists items for a given order id. */
    List<OrderItem> findByOrder_Id(Long orderId);
    void deleteByOrder_Id(Long orderId);
}
