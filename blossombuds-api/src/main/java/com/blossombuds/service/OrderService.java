package com.blossombuds.service;

import com.blossombuds.domain.*;
import com.blossombuds.dto.*;
import com.blossombuds.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** Application service for Orders, Items, Payments, and Events. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrderService {

    private final OrderRepository orderRepo;
    private final OrderItemRepository itemRepo;
    private final PaymentRepository paymentRepo;
    private final OrderEventRepository eventRepo;
    private final EmailService emailService;
    private final CustomerRepository customerRepository;
    private final DeliveryFeeRulesService deliveryFeeService;
    private final DistrictRepository districtRepository;
    private final StateRepository stateRepository;
    private final CountryRepository countryRepository;
    private final TrackingLinkService trackingLinkService;


    /** Optional: used to call next_public_code(); can be null in tests. */
    private final JdbcTemplate jdbcTemplate;

    // ────────────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────────────

    /** Strips optional "BB" prefix and uppercases; returns bare YYNNNN. */
    private static String normalizePublicCode(String code) {
        if (code == null) return null;
        String c = code.trim().toUpperCase();
        return c.startsWith("BB") ? c.substring(2) : c;
    }

    /** Best-effort: call DB function public.next_public_code(); returns null if not available. */
    private String tryGeneratePublicCode() {
        if (jdbcTemplate == null) return null;
        try {
            return jdbcTemplate.queryForObject("select public.next_public_code()", String.class);
        } catch (Exception ignore) {
            return null;
        }
    }

    /** Returns true if the provided PIN looks like an Indian 6-digit PIN. */
    private static boolean isValidIndianPin(String pin) {
        return pin != null && pin.matches("^[1-9][0-9]{5}$");
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Orders
    // ────────────────────────────────────────────────────────────────────────────

    /** Creates a new order (India-only shipping) and sends confirmation email. */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public Order createOrder(OrderDto dto) {
        if (dto == null) throw new IllegalArgumentException("OrderDto is required");

        Customer cust = customerRepository.findById(dto.getCustomerId())
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + dto.getCustomerId()));
        District district = districtRepository.findById(dto.getShipDistrictId())
                .orElseThrow(() -> new IllegalArgumentException("District not found: " + dto.getShipDistrictId()));
        State state = stateRepository.findById(dto.getShipStateId())
                .orElseThrow(() -> new IllegalArgumentException("State not found: " + dto.getShipStateId()));
        Country country = countryRepository.findById(dto.getShipCountryId())
                .orElseThrow(() -> new IllegalArgumentException("Country not found: " + dto.getShipCountryId()));

        // India-only enforcement at the service layer (name-based)
        if (country.getName() == null || !"India".equalsIgnoreCase(country.getName().trim())) {
            throw new IllegalArgumentException("International orders are not accepted via website");
        }

        if (!isValidIndianPin(dto.getShipPincode())) {
            throw new IllegalArgumentException("Invalid Indian PIN code");
        }

        // Public code: prefer DB function; else use provided and validate YYNNNN
        String code = tryGeneratePublicCode();
        if (code == null) {
            code = normalizePublicCode(dto.getPublicCode());
            if (code == null || !code.matches("^\\d{6}$")) {
                throw new IllegalArgumentException("publicCode missing/invalid and next_public_code() unavailable");
            }
        }

        // --- SHIPPING FEE: verify & correct ---
        // Client should already have previewed it, but server recomputes to prevent tampering.
        BigDecimal expectedShipping = deliveryFeeService.computeFeeWithThreshold(
                dto.getItemsSubtotal(), dto.getShipStateId(), dto.getShipDistrictId()
        );
        if (expectedShipping == null || expectedShipping.signum() < 0) {
            expectedShipping = BigDecimal.ZERO;
        }

        BigDecimal submittedShipping = dto.getShippingFee() == null ? BigDecimal.ZERO : dto.getShippingFee();
        BigDecimal shippingToUse = expectedShipping;

        // Optionally log/audit if submitted != expected
        if (submittedShipping.compareTo(expectedShipping) != 0) {
            // log.warn("Submitted shipping ({}) differs from expected ({}). Using expected.", submittedShipping, expectedShipping);
        }

        // Compute grand total server-side (authoritative)
        BigDecimal itemsSubtotal = dto.getItemsSubtotal() == null ? BigDecimal.ZERO : dto.getItemsSubtotal();
        BigDecimal discountTotal = dto.getDiscountTotal() == null ? BigDecimal.ZERO : dto.getDiscountTotal();
        if (discountTotal.signum() < 0) discountTotal = BigDecimal.ZERO; // defensive
        BigDecimal computedGrand = itemsSubtotal.add(shippingToUse).subtract(discountTotal);
        if (computedGrand.signum() < 0) computedGrand = BigDecimal.ZERO;

        Order o = new Order();
        o.setPublicCode(code);
        o.setCustomerId(dto.getCustomerId());
        o.setStatus(dto.getStatus());

        o.setItemsSubtotal(itemsSubtotal);
        o.setShippingFee(shippingToUse);          // ← authoritative, verified value
        o.setDiscountTotal(discountTotal);
        o.setGrandTotal(computedGrand);           // ← authoritative, recomputed
        o.setCurrency(dto.getCurrency());

        o.setCourierName(dto.getCourierName());
        o.setOrderNotes(dto.getOrderNotes());
        o.setDeliveryPartnerId(dto.getDeliveryPartnerId());
        o.setTrackingNumber(dto.getTrackingNumber());
        String computedTracking = trackingLinkService.buildTrackingUrl(dto.getDeliveryPartnerId(), dto.getTrackingNumber());
        o.setTrackingUrl(computedTracking != null ? computedTracking : dto.getTrackingUrl());

        o.setDispatchedAt(dto.getDispatchedAt());
        o.setDeliveredAt(dto.getDeliveredAt());
        o.setCancelledAt(dto.getCancelledAt());
        o.setRefundedAt(dto.getRefundedAt());
        o.setTrackingEmailSentAt(dto.getTrackingEmailSentAt());
        o.setPaidAt(dto.getPaidAt());

        o.setPaymentMethod(dto.getPaymentMethod());
        o.setRzpOrderId(dto.getRzpOrderId());
        o.setRzpPaymentId(dto.getRzpPaymentId());

        // Shipping snapshot
        o.setShipName(dto.getShipName());
        o.setShipPhone(dto.getShipPhone());
        o.setShipLine1(dto.getShipLine1());
        o.setShipLine2(dto.getShipLine2());
        o.setShipDistrict(district);
        o.setShipState(state);
        o.setShipPincode(dto.getShipPincode());
        o.setShipCountry(country);

        o.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);

        Order saved = orderRepo.save(o);

        // Confirmation email
        emailService.sendOrderConfirmation(
                cust.getEmail(),
                cust.getName(),
                saved.getPublicCode(),
                saved.getCurrency(),
                saved.getGrandTotal()
        );
        return saved;
    }


    /** Retrieves an order by BBYYNNNN/YYNNNN public code (case-insensitive for BB prefix). */
    public Optional<Order> getByPublicCode(String anyPublicCode) {
        String bare = normalizePublicCode(anyPublicCode);
        return orderRepo.findByPublicCode(bare);
    }

    /** Lists orders for a customer id (newest first). */
    public List<Order> listByCustomer(Long customerId) {
        if (customerId == null) throw new IllegalArgumentException("customerId is required");
        return orderRepo.findByCustomerIdOrderByIdDesc(customerId);
    }

    /** Updates order status, records a status-change event, and emails the customer. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Order updateStatus(Long orderId, OrderStatus newStatus, String eventNote, String actor) {
        if (orderId == null || newStatus == null) {
            throw new IllegalArgumentException("orderId and newStatus are required");
        }
        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        OrderStatus old = order.getStatus();
        if (old == newStatus) return order; // idempotent

        order.setStatus(newStatus);
        order.setModifiedAt(OffsetDateTime.now());
        order.setModifiedBy(actor != null ? actor : "system");

        // Update timestamps for key transitions
        switch (newStatus) {
            case DISPATCHED -> order.setDispatchedAt(OffsetDateTime.now());
            case DELIVERED  -> order.setDeliveredAt(OffsetDateTime.now());
            case CANCELLED  -> order.setCancelledAt(OffsetDateTime.now());
            case REFUNDED   -> order.setRefundedAt(OffsetDateTime.now());
            default -> { /* no-op */ }
        }

        orderRepo.save(order);

        // Append event
        OrderEvent ev = new OrderEvent();
        ev.setOrder(order);
        ev.setEventType("STATUS_CHANGED");
        ev.setNote((eventNote != null && !eventNote.isBlank() ? eventNote + " " : "") + "(" + old + " → " + newStatus + ")");
        ev.setCreatedAt(OffsetDateTime.now());
        ev.setCreatedBy(actor != null ? actor : "system");
        eventRepo.save(ev);

        // Email update (with tracking link if present)
        Customer cust = customerRepository.findById(order.getCustomerId()).orElse(null);
        if (cust != null && cust.getEmail() != null && !cust.getEmail().isBlank()) {
            String bbCode = "BB" + order.getPublicCode();
            String trackingUrl = order.getTrackingUrl();
            emailService.sendOrderStatusChanged(
                    cust.getEmail(),
                    cust.getName(),
                    bbCode,
                    newStatus.name(),              // ← correct: pass newStatus
                    eventNote,
                    trackingUrl
            );
        }

        return order;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Order Items
    // ────────────────────────────────────────────────────────────────────────────

    /** Adds a line item to an order (snapshots fields; does not lookup product). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public OrderItem addItem(Long orderId, OrderItemDto dto) {
        if (orderId == null || dto == null) {
            throw new IllegalArgumentException("orderId and OrderItemDto are required");
        }
        Order o = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        OrderItem it = new OrderItem();
        it.setOrder(o);
        it.setProductName(dto.getProductName());
        it.setProductSlug(dto.getProductSlug());
        it.setProductId(dto.getProductId());
        it.setQuantity(dto.getQuantity());
        it.setUnitPrice(dto.getUnitPrice());
        it.setLineTotal(dto.getLineTotal());
        it.setOptionsJson(dto.getOptionsJson());
        it.setOptionsText(dto.getOptionsText());
        it.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);
        it.setCreatedBy(dto.getCreatedBy());
        it.setCreatedAt(dto.getCreatedAt() != null ? dto.getCreatedAt() : OffsetDateTime.now());
        it.setModifiedBy(dto.getModifiedBy());
        it.setModifiedAt(dto.getModifiedAt() != null ? dto.getModifiedAt() : it.getCreatedAt());

        return itemRepo.save(it);
    }

    /** Lists items for an order id. */
    public List<OrderItem> listItems(Long orderId) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");
        return itemRepo.findByOrder_Id(orderId);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Payments
    // ────────────────────────────────────────────────────────────────────────────

    /** Records a payment row for an order and appends a payment event. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Payment recordPayment(Long orderId, PaymentDto dto) {
        if (orderId == null || dto == null) {
            throw new IllegalArgumentException("orderId and PaymentDto are required");
        }
        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        Payment p = new Payment();
        p.setOrder(order);
        p.setStatus(dto.getStatus());
        p.setAmount(dto.getAmount());
        p.setCurrency(dto.getCurrency());
        p.setRzpOrderId(dto.getRzpOrderId());
        p.setRzpPaymentId(dto.getRzpPaymentId());
        p.setActive(Boolean.TRUE);
        p.setCreatedAt(OffsetDateTime.now());
        p.setCreatedBy(dto.getCreatedBy());
        p.setModifiedAt(p.getCreatedAt());
        p.setModifiedBy(p.getCreatedBy());
        paymentRepo.save(p);

        // Order timestamps/status hooks
        if (dto.getStatus() == PaymentStatus.CAPTURED) {
            order.setPaidAt(OffsetDateTime.now());
            orderRepo.save(order);
        }

        // Append payment event
        OrderEvent ev = new OrderEvent();
        ev.setOrder(order);
        ev.setEventType("PAYMENT_" + dto.getStatus().name());
        ev.setNote("RZP order=" + dto.getRzpOrderId() + ", payment=" + dto.getRzpPaymentId());
        ev.setCreatedAt(OffsetDateTime.now());
        ev.setCreatedBy(p.getCreatedBy());
        eventRepo.save(ev);

        return p;
    }

    /** Lists payments for an order id. */
    public List<Payment> listPayments(Long orderId) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");
        return paymentRepo.findByOrder_Id(orderId);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────────

    /** Appends a custom event to an order (e.g., note, email sent, etc.). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public OrderEvent addEvent(Long orderId, String eventType, String note, String actor) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");
        Order o = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
        OrderEvent evt = new OrderEvent();
        evt.setOrder(o);
        evt.setEventType(eventType);
        evt.setNote(note);
        evt.setCreatedBy(actor);
        evt.setCreatedAt(OffsetDateTime.now());
        return eventRepo.save(evt);
    }

    /** Lists events for an order (oldest → newest). */
    public List<OrderEvent> listEvents(Long orderId) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");
        return eventRepo.findByOrder_IdOrderByCreatedAtAsc(orderId);
    }

    /** Creates a new PAID order from a draft + items (used after payment capture). */
    @Transactional
    public Order createOrderAsPaid(OrderDto dto, List<OrderItemDto> items) {
        // Reuse your existing createOrder(OrderDto) logic but do not send confirmation yet.
        // (We’ll let payment-record or this method send confirmation as you prefer.)
        Order o = createOrder(dto); // uses delivery fee calc & sets fields

        // attach items snapshot
        if (items != null) {
            for (OrderItemDto it : items) {
                it.setActive(Boolean.TRUE);
                it.setCreatedBy("system");
                it.setCreatedAt(OffsetDateTime.now());
                addItem(o.getId(), it);
            }
        }

        // Mark paid now
        o.setPaidAt(OffsetDateTime.now());
        orderRepo.save(o);

        // send confirmation mail here (since order is now real & paid)
        var cust = customerRepository.findById(o.getCustomerId()).orElse(null);
        if (cust != null) {
            emailService.sendOrderConfirmation(
                    cust.getEmail(),
                    cust.getName(),
                    o.getPublicCode(),
                    o.getCurrency(),
                    o.getGrandTotal()
            );
        }
        return o;
    }

}
