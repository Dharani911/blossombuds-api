package com.blossombuds.repository;

import com.blossombuds.domain.Order;
import com.blossombuds.domain.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/** Repository for reading/writing orders. */
public interface OrderRepository extends JpaRepository<Order, Long> {

    /** Finds an order by its 6-char public code (YYNNNN). */
    Optional<Order> findByPublicCode(String publicCode);
    Optional<Order> findByIdAndCustomerId(Long id, Long customerId);

    /** Lists orders for a customer, newest first. */
    List<Order> findByCustomerIdOrderByIdDesc(Long customerId);

    /** Lists orders by status, newest first. */
    List<Order> findByStatusOrderByIdDesc(OrderStatus status);

    @EntityGraph(attributePaths = {"shipDistrict","shipState","shipCountry"})
    @Query("select o from Order o where o.id = :id")
    Optional<Order> findByIdWithShipGeo(@Param("id") Long id);


    // -------------------- Existing paging/time filters --------------------

    // If you really want to include only active orders, keep these.
    Page<Order> findByActiveTrue(Pageable pageable);

    Page<Order> findByActiveTrueAndCreatedAtGreaterThanEqual(
            LocalDateTime from, Pageable pageable);

    Page<Order> findByActiveTrueAndCreatedAtLessThan(
            LocalDateTime to, Pageable pageable);

    Page<Order> findByActiveTrueAndCreatedAtBetween(
            LocalDateTime from, LocalDateTime to, Pageable pageable);

    // If you do NOT want to force active=true, add the same 4 without ActiveTrue:
    Page<Order> findAll(Pageable pageable);
    Page<Order> findByCreatedAtGreaterThanEqual(LocalDateTime from, Pageable p);
    Page<Order> findByCreatedAtLessThan(LocalDateTime to, Pageable p);
    Page<Order> findByCreatedAtBetween(LocalDateTime from, LocalDateTime to, Pageable p);


    // -------------------- NEW: Status-aware variants --------------------

    /** Simple status-only paging. */
    Page<Order> findByStatus(OrderStatus status, Pageable pageable);

    /** Multiple statuses (IN). */
    Page<Order> findByStatusIn(List<OrderStatus> statuses, Pageable pageable);

    /** Status + time windows (no active flag). */
    Page<Order> findByStatusAndCreatedAtGreaterThanEqual(
            OrderStatus status, LocalDateTime from, Pageable pageable);

    Page<Order> findByStatusAndCreatedAtLessThan(
            OrderStatus status, LocalDateTime to, Pageable pageable);

    Page<Order> findByStatusAndCreatedAtBetween(
            OrderStatus status, LocalDateTime from, LocalDateTime to, Pageable pageable);

    /** Status IN + time windows (no active flag). */
    Page<Order> findByStatusInAndCreatedAtGreaterThanEqual(
            List<OrderStatus> statuses, LocalDateTime from, Pageable pageable);

    Page<Order> findByStatusInAndCreatedAtLessThan(
            List<OrderStatus> statuses, LocalDateTime to, Pageable pageable);

    Page<Order> findByStatusInAndCreatedAtBetween(
            List<OrderStatus> statuses, LocalDateTime from, LocalDateTime to, Pageable pageable);

    /** Active + status + (optional) time windows. */
    Page<Order> findByActiveTrueAndStatus(OrderStatus status, Pageable pageable);

    Page<Order> findByActiveTrueAndStatusIn(List<OrderStatus> statuses, Pageable pageable);

    Page<Order> findByActiveTrueAndStatusAndCreatedAtGreaterThanEqual(
            OrderStatus status, LocalDateTime from, Pageable pageable);

    Page<Order> findByActiveTrueAndStatusAndCreatedAtLessThan(
            OrderStatus status, LocalDateTime to, Pageable pageable);

    Page<Order> findByActiveTrueAndStatusAndCreatedAtBetween(
            OrderStatus status, LocalDateTime from, LocalDateTime to, Pageable pageable);

    Page<Order> findByActiveTrueAndStatusInAndCreatedAtGreaterThanEqual(
            List<OrderStatus> statuses, LocalDateTime from, Pageable pageable);

    Page<Order> findByActiveTrueAndStatusInAndCreatedAtLessThan(
            List<OrderStatus> statuses, LocalDateTime to, Pageable pageable);

    Page<Order> findByActiveTrueAndStatusInAndCreatedAtBetween(
            List<OrderStatus> statuses, LocalDateTime from, LocalDateTime to, Pageable pageable);
}
