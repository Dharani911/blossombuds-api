package com.blossombuds.web;

import com.blossombuds.domain.*;
import com.blossombuds.dto.OrderDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.dto.PaymentDto;
import com.blossombuds.service.OrderService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** HTTP endpoints for orders, items, payments, and events. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/orders")
@Validated
public class OrderController {

    private final OrderService orders;

    // ── Orders ────────────────────────────────────────────────────────────────

    /**
     * Creates an order (admin/internal). For public checkout, use Razorpay flow:
     * - client pays → webhook verifies → server calls OrderService.createOrder(...)
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public Order createOrder(@Valid @RequestBody OrderDto dto, Authentication auth) {
        return orders.createOrder(dto);
    }

    /** Fetch an order by public code (YYNNNN or BBYYNNNN) — public tracking. */
    @GetMapping("/{publicCode}")
    public Order getByPublicCode(@PathVariable String publicCode) {
        return orders.getByPublicCode(publicCode)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + publicCode));
    }

    /** List orders for a customer (customer can see only their own; admins can see any). */
    @GetMapping("/by-customer/{customerId}")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public List<Order> listByCustomer(@PathVariable @Min(1) Long customerId, Authentication auth) {
        ensureOwnershipOrAdmin(auth, customerId);
        return orders.listByCustomer(customerId);
    }

    /** Update order status and append an event note (admin). */
    @PatchMapping("/{orderId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public Order updateStatus(@PathVariable @Min(1) Long orderId,
                              @RequestBody @Valid UpdateStatusRequest body,
                              Authentication auth) {
        return orders.updateStatus(orderId, body.getStatus(), body.getNote(), actor(auth));
    }

    // ── Items ────────────────────────────────────────────────────────────────

    /** Add a line item to an order (admin). */
    @PostMapping("/{orderId}/items")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderItem addItem(@PathVariable @Min(1) Long orderId,
                             @Valid @RequestBody OrderItemDto dto) {
        return orders.addItem(orderId, dto);
    }

    /** List items for an order (admin). */
    @GetMapping("/{orderId}/items")
    @PreAuthorize("hasRole('ADMIN')")
    public List<OrderItem> listItems(@PathVariable @Min(1) Long orderId) {
        return orders.listItems(orderId);
    }

    // ── Payments ──────────────────────────────────────────────────────────────

    /** Record a payment for an order (admin / internal). */
    @PostMapping("/{orderId}/payments")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public Payment recordPayment(@PathVariable @Min(1) Long orderId,
                                 @Valid @RequestBody PaymentDto dto) {
        return orders.recordPayment(orderId, dto);
    }

    /** List payments for an order (admin). */
    @GetMapping("/{orderId}/payments")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Payment> listPayments(@PathVariable @Min(1) Long orderId) {
        return orders.listPayments(orderId);
    }

    // ── Events ────────────────────────────────────────────────────────────────

    /** Append a custom event to an order (admin). */
    @PostMapping("/{orderId}/events")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderEvent addEvent(@PathVariable @Min(1) Long orderId,
                               @RequestBody @Valid AddEventRequest body,
                               Authentication auth) {
        return orders.addEvent(orderId, body.getEventType(), body.getNote(), actor(auth));
    }

    /** List events for an order (admin). */
    @GetMapping("/{orderId}/events")
    @PreAuthorize("hasRole('ADMIN')")
    public List<OrderEvent> listEvents(@PathVariable @Min(1) Long orderId) {
        return orders.listEvents(orderId);
    }

    // ── Request payloads ─────────────────────────────────────────────────────

    /** Payload for updating order status. */
    @Data
    public static class UpdateStatusRequest {
        private OrderStatus status; // ORDERED, DISPATCHED, DELIVERED, CANCELLED, REFUNDED, RETURNED_REFUNDED
        private String note;        // optional event note
    }

    /** Payload for adding a custom event. */
    @Data
    public static class AddEventRequest {
        private String eventType;   // e.g., EMAIL_SENT, NOTE, STATUS_CHANGED
        private String note;        // free text
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String actor(Authentication auth) {
        return (auth != null && auth.getName() != null) ? auth.getName() : "system";
    }

    /**
     * Enforce that CUSTOMER can only access their own orders in /by-customer/{id}.
     * Admins can access any customerId. Assumes principal name is "cust:{id}" for customers.
     */
    private void ensureOwnershipOrAdmin(Authentication auth, Long pathCustomerId) {
        if (auth == null) throw new IllegalArgumentException("Unauthorized");
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (isAdmin) return;

        boolean isCustomer = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_CUSTOMER".equals(a.getAuthority()));
        if (!isCustomer) throw new IllegalArgumentException("Forbidden");

        Long authCustomerId = parseCustomerId(auth.getName());
        if (authCustomerId == null || !authCustomerId.equals(pathCustomerId)) {
            throw new IllegalArgumentException("You can only view your own orders");
        }
    }

    private Long parseCustomerId(String principal) {
        try {
            if (principal != null && principal.startsWith("cust:")) {
                return Long.parseLong(principal.substring("cust:".length()));
            }
        } catch (Exception ignored) {}
        return null;
    }
}
