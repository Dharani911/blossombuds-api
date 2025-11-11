package com.blossombuds.web;

import com.blossombuds.domain.OrderStatus;
import com.blossombuds.dto.*;
import com.blossombuds.service.OrderService;
import com.blossombuds.service.OrderService.OrderEventView;
import com.blossombuds.service.OrderService.OrderItemView;
import com.blossombuds.service.OrderService.OrderLiteDto;
import com.blossombuds.service.OrderService.PaymentView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** HTTP endpoints for orders, items, payments, and events (DTO/View layer). */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/orders")
@Validated
public class OrderController {

    private final OrderService orders;

    // ── Orders ────────────────────────────────────────────────────────────────

    /**
     * Creates an order (admin/internal). For public checkout: client pays → webhook → service.createOrder(...)
     * Returns a lite DTO to avoid lazy serialization and to include friendly names.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderLiteDto createOrderWithItems(@Valid @RequestBody OrderCreateRequest req) {
        if (req == null || req.getOrder() == null) {
            throw new IllegalArgumentException("Order payload is required");
        }
        var created = orders.createOrderWithItems(req.getOrder(), req.getItems());
        // Map to lite (with location names) using the stored public code (bare YYNNNN)
        return orders.getByPublicCodeLite(created.getPublicCode())
                .orElseThrow(() -> new IllegalStateException("Order created but could not be re-fetched"));
    }

    @PutMapping("/{orderId}")
    @PreAuthorize("hasRole('ADMIN')")
    public OrderLiteDto updateOrder(@PathVariable @Min(1) Long orderId,
                                    @Valid @RequestBody OrderUpdateRequest req) {
        boolean replace = req.getReplaceItems() == null || Boolean.TRUE.equals(req.getReplaceItems());
        var updated = orders.updateOrder(orderId, req.getOrder(), req.getItems(), replace);
        return orders.getByPublicCodeLite(updated.getPublicCode())
                .orElseThrow(() -> new IllegalStateException("Order updated but could not be re-fetched"));
    }

    /** Fetch an order by public code (YYNNNN or BBYYNNNN) — returns lite DTO for public/admin view. */
    @GetMapping("/{publicCode}")
    public OrderService.OrderDetailDto getByPublicCode(@PathVariable String publicCode) {
        return orders.getDetailByPublicCode(publicCode)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + publicCode));
    }

    /** List orders for a customer (customer can see only their own; admins any). */
    @GetMapping("/by-customer/{customerId}")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public List<OrderLiteDto> listByCustomer(@PathVariable @Min(1) Long customerId, Authentication auth) {
        ensureOwnershipOrAdmin(auth, customerId);
        return orders.listByCustomerLite(customerId); // still the lite summary list
    }

    /** Page through all orders (admin) — lite DTOs (status + readable location names). */
    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<OrderService.OrderLiteDto> listAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "id") String sort,
            @RequestParam(defaultValue = "DESC") String dir,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            // NEW: accept repeated or CSV status values
            @RequestParam(name = "status", required = false) List<String> statusParams
    ) {
        // Normalize: support repeated params and/or a single CSV token
        String statusesCsv = null;
        if (statusParams != null && !statusParams.isEmpty()) {
            if (statusParams.size() == 1) {
                statusesCsv = statusParams.get(0);          // could already be CSV
            } else {
                statusesCsv = String.join(",", statusParams); // combine repeated values
            }
        }

        return orders.listAllLite(page, size, sort, dir, from, to, statusesCsv);
    }


    /** Update order status and append an event note (admin). Returns lite DTO. */
    @PatchMapping("/{orderId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public OrderLiteDto updateStatus(@PathVariable @Min(1) Long orderId,
                                     @RequestBody @Valid UpdateStatusRequest body,
                                     Authentication auth) {
        var updated = orders.updateStatus(orderId, body, body.getNote(), actor(auth));
        return orders.getByPublicCodeLite(updated.getPublicCode())
                .orElseThrow(() -> new IllegalStateException("Order updated but could not be re-fetched"));
    }

    // ── Items (view) ──────────────────────────────────────────────────────────

    /** Add a line item to an order (admin). Returns view row. */
    @PostMapping("/{orderId}/items")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderItemView addItem(@PathVariable @Min(1) Long orderId,
                                 @Valid @RequestBody OrderItemDto dto) {
        var saved = orders.addItem(orderId, dto);
        // Re-list as a view and pick the saved one (keeps the controller thin)
        return orders.listItemsView(orderId).stream()
                .filter(v -> v.getId().equals(saved.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Item saved but not found"));
    }

    /** List items for an order (admin) — safe view DTOs (no back-references). */
    @GetMapping("/{orderId}/items")
    @PreAuthorize("hasRole('ADMIN')")
    public List<OrderItemView> listItems(@PathVariable @Min(1) Long orderId) {
        return orders.listItemsView(orderId);
    }

    // ── Payments (view) ───────────────────────────────────────────────────────

    /** Record a payment for an order (admin/internal). Returns view row. */
    @PostMapping("/{orderId}/payments")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentView recordPayment(@PathVariable @Min(1) Long orderId,
                                     @Valid @RequestBody PaymentDto dto) {
        var p = orders.recordPayment(orderId, dto);
        return orders.listPaymentsView(orderId).stream()
                .filter(v -> v.getId().equals(p.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Payment saved but not found"));
    }

    /** List payments for an order (admin). */
    @GetMapping("/{orderId}/payments")
    @PreAuthorize("hasRole('ADMIN')")
    public List<PaymentView> listPayments(@PathVariable @Min(1) Long orderId) {
        return orders.listPaymentsView(orderId);
    }

    // ── Events (view) ─────────────────────────────────────────────────────────

   /* *//** Append a custom event to an order (admin). Returns view row. *//*
    @PostMapping("/{orderId}/events")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderEventView addEvent(@PathVariable @Min(1) Long orderId,
                                   @RequestBody @Valid AddEventRequest body,
                                   Authentication auth) {
        var ev = orders.addEvent(orderId, body.getEventType(), body.getNote(), actor(auth));
        return orders.listEventsView(orderId).stream()
                .filter(v -> v.getId().equals(ev.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Event saved but not found"));
    }*/

    /** List events for an order (admin). */
    @GetMapping("/{orderId}/events")
    @PreAuthorize("hasRole('ADMIN')")
    public List<OrderEventView> listEvents(@PathVariable @Min(1) Long orderId) {
        return orders.listEventsView(orderId);
    }

    // ── Request payloads ─────────────────────────────────────────────────────

    @Data
    public static class UpdateStatusRequest {
        private OrderStatus status; // ORDERED, DISPATCHED, DELIVERED, CANCELLED, REFUNDED, RETURNED_REFUNDED
        private String note;
        private String trackingNumber;
        private String trackingURL;// optional event note
    }

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
     * CUSTOMER can only access their own orders in /by-customer/{id}.
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
