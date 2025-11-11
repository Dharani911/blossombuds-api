package com.blossombuds.service;

import com.blossombuds.domain.*;
import com.blossombuds.dto.*;
import com.blossombuds.repository.*;
import com.blossombuds.web.OrderController;
import lombok.*;
import org.springframework.data.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

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
    private final DeliveryPartnerRepository deliveryPartnerRepository;
    private final CouponRepository couponRepository;
    private final CouponRedemptionRepository couponRedemptionRepository;
    private final CatalogService catalogService;


    /** Optional: used to call next_public_code(); can be null in tests. */
    private final JdbcTemplate jdbcTemplate;

    // ───────────────────────────────────────── Helpers ─────────────────────────────────────────

    /** Strips optional "BB" prefix and uppercases; returns bare YYNNNN. */
    private static String normalizePublicCode(String code) {
        if (code == null) return null;
        String c = code.trim().toUpperCase(Locale.ROOT);
        return c.startsWith("BB") ? c.substring(2) : c;
    }

    /** Best-effort: call DB function public.next_public_code(); returns null if not available. */
    private String tryGeneratePublicCode() {
        if (jdbcTemplate == null) return null;
        try {
            return jdbcTemplate.queryForObject("select next_public_code()", String.class);
        } catch (Exception ignore) { return null; }
    }

    /** Returns true if provided PIN looks like an Indian 6-digit PIN. */
    private static boolean isValidIndianPin(String pin) {
        return pin != null && pin.matches("^[1-9][0-9]{5}$");
    }

    private static boolean isIndia(Country c) {
        return c != null && c.getName() != null && c.getName().trim().equalsIgnoreCase("India");
    }

    // ───────────────────────────────────────── Commands ─────────────────────────────────────────

    /**
     * Creates a new order.
     * - International allowed; India-only checks apply to India.
     * - Shipping fee authoritative (India: computed, International: as provided/default 0).
     */
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public Order createOrder(OrderDto dto) {
        if (dto == null) throw new IllegalArgumentException("OrderDto is required");

        Coupon resolvedCoupon = null;
        if (dto.getCouponId() != null) {
            resolvedCoupon = couponRepository.findById(dto.getCouponId())
                    .orElseThrow(() -> new IllegalArgumentException("Coupon not found: " + dto.getCouponId()));
        } else if (dto.getCouponCode() != null && !dto.getCouponCode().isBlank()) {
            resolvedCoupon = couponRepository.findByCodeIgnoreCase(dto.getCouponCode().trim())
                    .orElse(null); // optional: throw if required
        }
        if (resolvedCoupon != null) {
            if (Boolean.FALSE.equals(resolvedCoupon.getActive())) {
                throw new IllegalArgumentException("Coupon is inactive");
            }
            // Example optional checks (if your Coupon has these fields):
            // if (resolvedCoupon.getValidFrom()!=null && OffsetDateTime.now().isBefore(resolvedCoupon.getValidFrom())) ...
            // if (resolvedCoupon.getValidTo()!=null && OffsetDateTime.now().isAfter(resolvedCoupon.getValidTo())) ...
            // if (resolvedCoupon.getMinSubtotal()!=null && dto.getItemsSubtotal().compareTo(resolvedCoupon.getMinSubtotal())<0) ...
            // if (exceededPerCustomerLimit(resolvedCoupon.getId(), dto.getCustomerId())) ...
            // if (exceededGlobalLimit(resolvedCoupon.getId())) ...
        }

        Customer cust = customerRepository.findById(dto.getCustomerId())
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + dto.getCustomerId()));

        Country country = countryRepository.findById(dto.getShipCountryId())
                .orElseThrow(() -> new IllegalArgumentException("Country not found: " + dto.getShipCountryId()));

        District district = null;
        State state = null;
        if (dto.getShipDistrictId() != null) {
            district = districtRepository.findById(dto.getShipDistrictId())
                    .orElseThrow(() -> new IllegalArgumentException("District not found: " + dto.getShipDistrictId()));
        }
        if (dto.getShipStateId() != null) {
            state = stateRepository.findById(dto.getShipStateId())
                    .orElseThrow(() -> new IllegalArgumentException("State not found: " + dto.getShipStateId()));
        }

        boolean india = isIndia(country);

        if (india && !isValidIndianPin(dto.getShipPincode())) {
            throw new IllegalArgumentException("Invalid Indian PIN code");
        }

        String code = tryGeneratePublicCode();
        if (code == null) {
            code = normalizePublicCode(dto.getPublicCode());
            if (code == null || !code.matches("^\\d{6}$")) {
                throw new IllegalArgumentException("publicCode missing/invalid and next_public_code() unavailable");
            }
        }

        BigDecimal expectedShipping;
        if (india) {
            expectedShipping = deliveryFeeService.computeFeeWithThreshold(
                    dto.getItemsSubtotal(), dto.getShipStateId(), dto.getShipDistrictId()
            );
            if (expectedShipping == null || expectedShipping.signum() < 0) expectedShipping = BigDecimal.ZERO;
        } else {
            expectedShipping = dto.getShippingFee() == null ? BigDecimal.ZERO : dto.getShippingFee();
        }

        BigDecimal itemsSubtotal = nzd(dto.getItemsSubtotal());
        BigDecimal discountTotal = nzd(dto.getDiscountTotal());
        if (discountTotal.signum() < 0) discountTotal = BigDecimal.ZERO;

        BigDecimal computedGrand = itemsSubtotal.add(expectedShipping).subtract(discountTotal);
        if (computedGrand.signum() < 0) computedGrand = BigDecimal.ZERO;

        Order o = new Order();
        o.setPublicCode(code);
        o.setCustomerId(dto.getCustomerId());
        o.setStatus(dto.getStatus() != null ? dto.getStatus() : OrderStatus.ORDERED); // ensure not null

        o.setItemsSubtotal(itemsSubtotal);
        o.setShippingFee(expectedShipping);
        o.setDiscountTotal(discountTotal);
        o.setGrandTotal(computedGrand);
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

        if (dto.getExternalReference() != null && !dto.getExternalReference().isBlank()) {
            o.setExternalReference(dto.getExternalReference().trim());
        }


        // Shipping snapshot (entities kept LAZY; we’ll expose names via view DTOs)
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

        if (resolvedCoupon != null) {
            CouponRedemption red = new CouponRedemption();
            red.setCoupon(resolvedCoupon);
            red.setOrder(saved);
            red.setCustomerId(saved.getCustomerId());
            red.setAmountApplied(o.getDiscountTotal());
            red.setActive(Boolean.TRUE);
            couponRedemptionRepository.save(red);
        }


        if (o.getExternalReference() != null && !o.getExternalReference().isBlank()) {
            OrderEvent ev = new OrderEvent();
            ev.setOrder(saved);
            ev.setEventType("EXTERNAL_REF_ADDED");
            ev.setNote("External payment reference captured: " + o.getExternalReference());
            eventRepo.save(ev);
        }

        return saved;
    }
    @Transactional
    public Order createOrderAsPaid(OrderDto dto, List<OrderItemDto> items) {
        // Reuse your existing createOrder(OrderDto) logic but do not send confirmation yet.
        // (We’ll let payment-record or this method send confirmation as you prefer.)
        Order o = createOrder(dto); // uses delivery fee calc & sets fields

        // attach items snapshot
        if (items != null) {
            for (OrderItemDto it : items) {
                it.setActive(Boolean.TRUE);
                //it.setCreatedBy("system");
                //it.setCreatedAt(OffsetDateTime.now());
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


    private BigDecimal computeItemsSubtotal(List<OrderItemDto> items) {
        if (items == null || items.isEmpty()) return BigDecimal.ZERO;
        BigDecimal sum = BigDecimal.ZERO;
        for (OrderItemDto it : items) {
            BigDecimal lt = it.getLineTotal();
            if (lt == null) {
                BigDecimal unit = nzd(it.getUnitPrice());
                BigDecimal qty = it.getQuantity() == null ? BigDecimal.ZERO : new BigDecimal(it.getQuantity());
                lt = unit.multiply(qty);
            }
            sum = sum.add(lt);
        }
        return sum;
    }

    private static BigDecimal nzd(BigDecimal x) { return x == null ? BigDecimal.ZERO : x; }

    // CREATE with items
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN','CUSTOMER')")
    public Order createOrderWithItems(OrderDto dto, List<OrderItemDto> items) {
        if (dto.getItemsSubtotal() == null) dto.setItemsSubtotal(computeItemsSubtotal(items));
        Order order = createOrder(dto);

        Customer cust = customerRepository.findById(dto.getCustomerId())
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + dto.getCustomerId()));

        if (items != null && !items.isEmpty()) {
            for (OrderItemDto it : items) addItem(order.getId(), ensureItemNumbers(it));
        }

        emailService.sendOrderConfirmation(
                cust.getEmail(), cust.getName(), order.getPublicCode(), order.getCurrency(), order.getGrandTotal()
        );
        return order;
    }

    private static OrderItemDto ensureItemNumbers(OrderItemDto it){
        if (it.getQuantity()   == null) it.setQuantity(1);
        if (it.getUnitPrice()  == null) it.setUnitPrice(BigDecimal.ZERO);
        if (it.getLineTotal()  == null) it.setLineTotal(it.getUnitPrice().multiply(new BigDecimal(it.getQuantity())));
        return it;
    }

    // UPDATE order + optional replace items
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Order updateOrder(Long orderId, OrderDto patch, List<OrderItemDto> items, boolean replaceItems) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");

        Order existing = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
        OrderController.UpdateStatusRequest updateStatusRequest = new OrderController.UpdateStatusRequest();
            updateStatusRequest.setStatus(patch.getStatus());
            updateStatusRequest.setTrackingNumber(patch.getTrackingNumber());
            updateStatusRequest.setTrackingURL(patch.getTrackingUrl());

        if (patch != null && patch.getStatus() != null && patch.getStatus() != existing.getStatus()) {
            existing = updateStatus(orderId, updateStatusRequest , "(via updateOrder)", "system");
        }

        if (patch != null) {
            if (patch.getCustomerId() != null) existing.setCustomerId(patch.getCustomerId());
            existing.setCourierName(patch.getCourierName());
            existing.setOrderNotes(patch.getOrderNotes());
            existing.setDeliveryPartnerId(patch.getDeliveryPartnerId());
            existing.setTrackingNumber(patch.getTrackingNumber());
            existing.setTrackingUrl(patch.getTrackingUrl());

// Auto-build tracking URL when possible and URL not explicitly provided
            if ((patch.getTrackingUrl() == null || patch.getTrackingUrl().isBlank())
                    && (patch.getDeliveryPartnerId() != null || existing.getDeliveryPartnerId() != null)
                    && (patch.getTrackingNumber() != null || existing.getTrackingNumber() != null)) {
                Long partnerId = (patch.getDeliveryPartnerId() != null) ? patch.getDeliveryPartnerId() : existing.getDeliveryPartnerId();
                String tn = (patch.getTrackingNumber() != null) ? patch.getTrackingNumber() : existing.getTrackingNumber();
                if (partnerId != null && tn != null && !tn.isBlank()) {
                    String built = trackingLinkService.buildTrackingUrl(partnerId, tn);
                    if (built != null && !built.isBlank()) {
                        existing.setTrackingUrl(built);
                    }
                }
            }
            existing.setPaymentMethod(patch.getPaymentMethod());
            existing.setRzpOrderId(patch.getRzpOrderId());
            existing.setRzpPaymentId(patch.getRzpPaymentId());
            existing.setExternalReference(patch.getExternalReference());

            existing.setShipName(patch.getShipName());
            existing.setShipPhone(patch.getShipPhone());
            existing.setShipLine1(patch.getShipLine1());
            existing.setShipLine2(patch.getShipLine2());
            existing.setShipPincode(patch.getShipPincode());

            BigDecimal itemsSubtotal =
                    (items != null && !items.isEmpty())
                            ? computeItemsSubtotal(items)
                            : (patch.getItemsSubtotal() != null ? patch.getItemsSubtotal() : existing.getItemsSubtotal());

            BigDecimal discount = nzd(patch.getDiscountTotal() != null ? patch.getDiscountTotal() : existing.getDiscountTotal());
            BigDecimal shipping = nzd(patch.getShippingFee()    != null ? patch.getShippingFee()    : existing.getShippingFee());
            itemsSubtotal = nzd(itemsSubtotal);

            BigDecimal grand = itemsSubtotal.add(shipping).subtract(discount);
            if (grand.signum() < 0) grand = BigDecimal.ZERO;

            existing.setItemsSubtotal(itemsSubtotal);
            existing.setDiscountTotal(discount);
            existing.setShippingFee(shipping);
            existing.setGrandTotal(grand);
        }

        orderRepo.save(existing);

        if (items != null) {
            if (replaceItems) itemRepo.deleteByOrder_Id(orderId);
            for (OrderItemDto it : items) addItem(orderId, ensureItemNumbers(it));
        }
        return existing;
    }

    /** Updates order status, records event, and emails the customer. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Order updateStatus(Long orderId, OrderController.UpdateStatusRequest updateStatusRequest, String eventNote, String actor) {
        if (orderId == null || updateStatusRequest.getStatus() == null) throw new IllegalArgumentException("orderId and newStatus are required");
        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        OrderStatus old = order.getStatus();
        if (old == updateStatusRequest.getStatus()) return order;

        // --- enforce tracking for DISPATCHED ---
        if (updateStatusRequest.getStatus() == OrderStatus.DISPATCHED) {
            // Try to (re)build tracking URL if a partner is present but URL is missing
           /* if ((order.getTrackingUrl() == null || order.getTrackingUrl().isBlank())
                    && order.getDeliveryPartnerId() != null
                    && order.getTrackingNumber() != null && !order.getTrackingNumber().isBlank()) {
                String built = trackingLinkService.buildTrackingUrl(order.getDeliveryPartnerId(), order.getTrackingNumber());
                if (built != null && !built.isBlank()) {
                    order.setTrackingUrl(built);
                }
            }
            // Final gate: both must be present
            if (order.getTrackingNumber() == null || order.getTrackingNumber().isBlank()
                    || order.getTrackingUrl() == null || order.getTrackingUrl().isBlank()) {
                throw new IllegalArgumentException("Tracking number and tracking URL are required to mark as DISPATCHED");
            }*/
            order.setTrackingNumber(updateStatusRequest.getTrackingNumber());
            order.setTrackingUrl(updateStatusRequest.getTrackingURL());

        }

        order.setStatus(updateStatusRequest.getStatus());
        switch (updateStatusRequest.getStatus()) {
            case DISPATCHED -> order.setDispatchedAt(OffsetDateTime.now());
            case DELIVERED  -> order.setDeliveredAt(OffsetDateTime.now());
            case CANCELLED  -> order.setCancelledAt(OffsetDateTime.now());
            case REFUNDED   -> order.setRefundedAt(OffsetDateTime.now());
            default -> { }
        }

        orderRepo.save(order);

        if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.REFUNDED) {
            // a tiny helper in repo to find the redemption(s) for this order
            couponRedemptionRepository.findByOrder_IdAndActiveTrue(orderId).setActive(Boolean.FALSE);

        }

        OrderEvent ev = new OrderEvent();
        ev.setOrder(order);
        ev.setEventType("STATUS_CHANGED");
        ev.setNote((eventNote != null && !eventNote.isBlank() ? eventNote + " " : "") + "(" + old + " → " + updateStatusRequest.getStatus() + ")");
        eventRepo.save(ev);

        // Add a separate TRACKING event when we become DISPATCHED (auditable, even if FE also added one)
        if (updateStatusRequest.getStatus() == OrderStatus.DISPATCHED) {
            OrderEvent tr = new OrderEvent();
            tr.setOrder(order);
            tr.setEventType("TRACKING");
            tr.setNote("Tracking Number: " + order.getTrackingNumber() + " | URL: " + order.getTrackingUrl());

            eventRepo.save(tr);
        }

        Customer cust = customerRepository.findById(order.getCustomerId()).orElse(null);
        if (cust != null && cust.getEmail() != null && !cust.getEmail().isBlank()) {
            // PASS BARE YYNNNN to email templates (they add the 'BB' themselves)
            String bareCode = order.getPublicCode();
            emailService.sendOrderStatusChanged(
                    cust.getEmail(), cust.getName(), bareCode, updateStatusRequest.getStatus().name(), eventNote, order.getTrackingUrl()
            );
        }
        return order;
    }

    // ───────────────────────────── Items / Payments / Events (view DTOs) ─────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public OrderItem addItem(Long orderId, OrderItemDto dto) {
        if (orderId == null || dto == null) throw new IllegalArgumentException("orderId and OrderItemDto are required");
        Order o = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        OrderItem it = new OrderItem();
        it.setOrder(o);
        it.setProductName(dto.getProductName());
        it.setProductId(dto.getProductId());
        it.setQuantity(dto.getQuantity());
        it.setUnitPrice(dto.getUnitPrice());
        it.setLineTotal(dto.getLineTotal());
        it.setOptionsJson(dto.getOptionsJson());
        it.setOptionsText(dto.getOptionsText());
        it.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);

        return itemRepo.save(it);
    }

    /** View-model list without back-references (safe to serialize). */
    public List<OrderItemView> listItemsView(Long orderId) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");
        return itemRepo.findByOrder_Id(orderId).stream()
                .map(OrderService::toView)
                .collect(Collectors.toList());

    }

    public List<PaymentView> listPaymentsView(Long orderId) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");
        return paymentRepo.findByOrder_Id(orderId).stream()
                .map(OrderService::toView)
                .collect(Collectors.toList());
    }

    public List<OrderEventView> listEventsView(Long orderId) {
        if (orderId == null) throw new IllegalArgumentException("orderId is required");
        return eventRepo.findByOrder_IdOrderByCreatedAtAsc(orderId).stream()
                .map(OrderService::toView)
                .collect(Collectors.toList());
    }

    // ────────────────────────────── Queries for list/search (lite DTOs) ──────────────────────────────
    // OrderService.java (add next to getDetailForCustomer)

    @Transactional(readOnly = true)
    public Optional<OrderDetailDto> getDetailByPublicCode(String anyPublicCode) {
        String bare = normalizePublicCode(anyPublicCode);
        if (bare == null || bare.isBlank()) return Optional.empty();

        return orderRepo.findByPublicCode(bare).map(this::toLiteDetailDto);

    }

    private OrderDetailDto toLiteDetailDto(Order o){
        if (o.getShipCountry()!=null) countryCache = Map.of(o.getShipCountry().getId(), o.getShipCountry());
        if (o.getShipState()!=null)   stateCache   = Map.of(o.getShipState().getId(), o.getShipState());
        if (o.getShipDistrict()!=null)districtCache= Map.of(o.getShipDistrict().getId(), o.getShipDistrict());
        List<OrderItemViewWithImage> orderItemList=toOrderItemViewWithImage(o);
        OrderDetailDto d =new OrderDetailDto();
        d.setId(o.getId());
        d.setPublicCode(o.getPublicCode());
        d.setCustomerId(o.getCustomerId());
        d.setStatus(o.getStatus() != null ? o.getStatus().name() : OrderStatus.ORDERED.name());
        d.setItemsSubtotal(nzd(o.getItemsSubtotal()));
        d.setShippingFee(nzd(o.getShippingFee()));
        d.setDiscountTotal(nzd(o.getDiscountTotal()));
        d.setGrandTotal(nzd(o.getGrandTotal()));
        d.setCurrency(o.getCurrency());
        d.setOrderNotes(o.getOrderNotes());

        d.setShipName(o.getShipName());
        d.setShipPhone(o.getShipPhone());
        d.setShipLine1(o.getShipLine1());
        d.setShipLine2(o.getShipLine2());
        d.setShipPincode(o.getShipPincode());
        d.setCreatedDate(o.getCreatedAt());

        // NEW: pass partner & tracking fields to FE
        d.setDeliveryPartnerId(o.getDeliveryPartnerId());
        d.setCourierName(o.getCourierName());
        d.setTrackingNumber(o.getTrackingNumber());


        if (o.getDeliveryPartnerId()!=null){
            DeliveryPartner deliveryPartner = deliveryPartnerRepository.findById(o.getDeliveryPartnerId()).orElseThrow(() -> new IllegalArgumentException("Delivery Partner not found: " + o.getDeliveryPartnerId()));
            d.setTrackingUrl(deliveryPartner.getTrackingUrlTemplate());
        } else {d.setTrackingUrl(o.getTrackingUrl());}

        CouponRedemption couponRedemption=couponRedemptionRepository.findByOrder_IdAndActiveTrue(o.getId());

        if(couponRedemption!=null){
            d.setCouponId(couponRedemption.getCoupon().getId());
            d.setCouponCode(couponRedemption.getCoupon().getCode());}

        if (o.getShipCountry()!=null) {
            Country c = countryCache.getOrDefault(o.getShipCountry().getId(), o.getShipCountry());
            d.setShipCountryId(c.getId());
            d.setShipCountryName(c.getName());
        }
        if (o.getShipState()!=null) {
            State s = stateCache.getOrDefault(o.getShipState().getId(), o.getShipState());
            d.setShipStateId(s.getId());
            d.setShipStateName(s.getName());
        }
        if (o.getShipDistrict()!=null) {
            District di = districtCache.getOrDefault(o.getShipDistrict().getId(), o.getShipDistrict());
            d.setShipDistrictId(di.getId());
            d.setShipDistrictName(di.getName());
        }
        d.setItems(orderItemList);
        return d;
    }


    private static BigDecimal nv(BigDecimal b) {
        return b == null ? BigDecimal.ZERO : b;
    }
    public Optional<OrderLiteDto> getByPublicCodeLite(String anyPublicCode) {
        String bare = normalizePublicCode(anyPublicCode);

        return orderRepo.findByPublicCode(bare).map(this::toLiteWithNames);
    }

    public List<OrderLiteDto> listByCustomerLite(Long customerId) {
        if (customerId == null) throw new IllegalArgumentException("customerId is required");
        List<Order> list = orderRepo.findByCustomerIdOrderByIdDesc(customerId);
        return attachLocationNames(list).stream().map(this::toLite).collect(Collectors.toList());
    }

    private static final Map<String,String> SORT_MAP = Map.of(
            "id", "id",
            "createdAt", "createdAt",
            "created_at", "createdAt"
    );
    @Data
    public static class OrderDetailDto {
        private Long id;
        private String publicCode;
        private Long customerId;
        private String status;

        private BigDecimal itemsSubtotal;
        private BigDecimal shippingFee;
        private BigDecimal discountTotal;
        private BigDecimal grandTotal;
        private String currency;

        private String shipName;
        private String shipPhone;
        private String shipLine1;
        private String shipLine2;
        private String shipPincode;

        private Long   shipCountryId;  private String shipCountryName;
        private Long   shipStateId;    private String shipStateName;
        private Long   shipDistrictId; private String shipDistrictName;
        private LocalDateTime createdDate;

        // --- NEW: expose partner + tracking details for FE ---
        private Long   deliveryPartnerId;   // used by FE to fetch partner config/template
        private String courierName;         // display-only
        private String trackingNumber;      // prefill in UI
        private String trackingUrl;         // prefill / preview in UI (may be empty if template-based)
        private Long couponId;
        private String couponCode;
        private String orderNotes;

        // Items
        private List<OrderItemViewWithImage> items;
    }




    public Page<OrderLiteDto> listAllLite(
            int page,
            int size,
            String sort,
            String dir,
            String fromIso,
            String toIso,
            String statusesCsv // NEW: optional, comma-separated (e.g., "ORDERED,DISPATCHED")
    ) {
        String sortField = (sort == null || sort.isBlank()) ? "id" : sort;
        Sort.Direction direction = Sort.Direction.fromOptionalString(dir).orElse(Sort.Direction.DESC);
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortField));

        LocalDateTime from = parseIsoToDbLocal(fromIso);
        LocalDateTime to   = parseIsoToDbLocal(toIso);

        // Parse statuses (empty => no status filter)
        List<OrderStatus> statuses = parseStatusesCsv(statusesCsv);

        Page<Order> pg;
        boolean activeOnly = true; // keep your existing toggle

        // --------------------- Routing matrix ---------------------
        // If no status filter => keep your original branches
        if (statuses.isEmpty()) {
            if (activeOnly) {
                if (from == null && to == null) {
                    pg = orderRepo.findByActiveTrue(pageable);
                } else if (from != null && to == null) {
                    pg = orderRepo.findByActiveTrueAndCreatedAtGreaterThanEqual(from, pageable);
                } else if (from == null && to != null) {
                    pg = orderRepo.findByActiveTrueAndCreatedAtLessThan(to, pageable);
                } else {
                    pg = orderRepo.findByActiveTrueAndCreatedAtBetween(from, to, pageable);
                }
            } else {
                if (from == null && to == null) {
                    pg = orderRepo.findAll(pageable);
                } else if (from != null && to == null) {
                    pg = orderRepo.findByCreatedAtGreaterThanEqual(from, pageable);
                } else if (from == null && to != null) {
                    pg = orderRepo.findByCreatedAtLessThan(to, pageable);
                } else {
                    pg = orderRepo.findByCreatedAtBetween(from, to, pageable);
                }
            }
        } else {
            // We have one or more statuses
            boolean single = (statuses.size() == 1);
            OrderStatus only = single ? statuses.get(0) : null;

            if (activeOnly) {
                if (single) {
                    if (from == null && to == null) {
                        pg = orderRepo.findByActiveTrueAndStatus(only, pageable);
                    } else if (from != null && to == null) {
                        pg = orderRepo.findByActiveTrueAndStatusAndCreatedAtGreaterThanEqual(only, from, pageable);
                    } else if (from == null && to != null) {
                        pg = orderRepo.findByActiveTrueAndStatusAndCreatedAtLessThan(only, to, pageable);
                    } else {
                        pg = orderRepo.findByActiveTrueAndStatusAndCreatedAtBetween(only, from, to, pageable);
                    }
                } else {
                    if (from == null && to == null) {
                        pg = orderRepo.findByActiveTrueAndStatusIn(statuses, pageable);
                    } else if (from != null && to == null) {
                        pg = orderRepo.findByActiveTrueAndStatusInAndCreatedAtGreaterThanEqual(statuses, from, pageable);
                    } else if (from == null && to != null) {
                        pg = orderRepo.findByActiveTrueAndStatusInAndCreatedAtLessThan(statuses, to, pageable);
                    } else {
                        pg = orderRepo.findByActiveTrueAndStatusInAndCreatedAtBetween(statuses, from, to, pageable);
                    }
                }
            } else {
                if (single) {
                    if (from == null && to == null) {
                        pg = orderRepo.findByStatus(only, pageable);
                    } else if (from != null && to == null) {
                        pg = orderRepo.findByStatusAndCreatedAtGreaterThanEqual(only, from, pageable);
                    } else if (from == null && to != null) {
                        pg = orderRepo.findByStatusAndCreatedAtLessThan(only, to, pageable);
                    } else {
                        pg = orderRepo.findByStatusAndCreatedAtBetween(only, from, to, pageable);
                    }
                } else {
                    if (from == null && to == null) {
                        pg = orderRepo.findByStatusIn(statuses, pageable);
                    } else if (from != null && to == null) {
                        pg = orderRepo.findByStatusInAndCreatedAtGreaterThanEqual(statuses, from, pageable);
                    } else if (from == null && to != null) {
                        pg = orderRepo.findByStatusInAndCreatedAtLessThan(statuses, to, pageable);
                    } else {
                        pg = orderRepo.findByStatusInAndCreatedAtBetween(statuses, from, to, pageable);
                    }
                }
            }
        }
        // ----------------------------------------------------------

        List<Order> enriched = attachLocationNames(pg.getContent());
        List<OrderLiteDto> dtoList = enriched.stream().map(this::toLite).toList();
        return new PageImpl<>(dtoList, pg.getPageable(), pg.getTotalElements());
    }

    /** Parse a CSV of enum names into a list; invalid tokens are ignored. */
    private List<OrderStatus> parseStatusesCsv(String statusesCsv) {
        if (statusesCsv == null || statusesCsv.isBlank()) return List.of();
        String[] parts = statusesCsv.split("[,;\\s]+");
        List<OrderStatus> out = new ArrayList<>(parts.length);
        for (String p : parts) {
            if (p == null || p.isBlank()) continue;
            try {
                out.add(OrderStatus.valueOf(p.trim().toUpperCase(Locale.ROOT)));
            } catch (IllegalArgumentException ignore) { /* skip invalid */ }
        }
        // dedupe while preserving order
        return out.stream().distinct().toList();
    }


    private LocalDateTime makeExclusiveUpper(LocalDateTime to) {
        return (to == null) ? null : to.plusSeconds(1); // or plusNanos(1) if your DB has higher precision
    }
    private static final ZoneId DB_ZONE = ZoneOffset.UTC;
    private LocalDateTime parseIsoToDbLocal(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            // Full ISO with zone/offset from frontend → normalize to DB zone, keep exclusivity semantics
            return OffsetDateTime.parse(iso).atZoneSameInstant(DB_ZONE).toLocalDateTime();
        } catch (DateTimeParseException e) {
            try {
                // No zone provided → interpret as DB zone local time
                return LocalDateTime.parse(iso);
            } catch (DateTimeParseException ex) {
                return null;
            }
        }
    }

    /** Batch-attach readable names (without touching lazy associations during JSON write). */
    private List<Order> attachLocationNames(List<Order> orders) {
        // Collect IDs
        Set<Long> cIds = new HashSet<>();
        Set<Long> sIds = new HashSet<>();
        Set<Long> dIds = new HashSet<>();
        for (Order o : orders) {
            if (o.getShipCountry()  != null) cIds.add(o.getShipCountry().getId());
            if (o.getShipState()    != null) sIds.add(o.getShipState().getId());
            if (o.getShipDistrict() != null) dIds.add(o.getShipDistrict().getId());
        }
        Map<Long, Country> cMap = cIds.isEmpty()? Map.of() : countryRepository.findAllById(cIds).stream().collect(Collectors.toMap(Country::getId, x->x));
        Map<Long, State>   sMap = sIds.isEmpty()? Map.of() : stateRepository.findAllById(sIds).stream().collect(Collectors.toMap(State::getId, x->x));
        Map<Long, District>dMap = dIds.isEmpty()? Map.of() : districtRepository.findAllById(dIds).stream().collect(Collectors.toMap(District::getId, x->x));

        // Stash readable names temporarily in transient fields via a thread-local map, or simply
        // prepare a sidecar cache we use in toLiteWithNames().
        this.countryCache = cMap; this.stateCache = sMap; this.districtCache = dMap;
        return orders;
    }

    // Sidecar caches for the current mapping pass (service is singleton; use within same thread only)
    private transient Map<Long, Country> countryCache = Map.of();
    private transient Map<Long, State> stateCache = Map.of();
    private transient Map<Long, District> districtCache = Map.of();

    private OrderLiteDto toLiteWithNames(Order o) {
        // ensure caches for single element
        if (o.getShipCountry()!=null) countryCache = Map.of(o.getShipCountry().getId(), o.getShipCountry());
        if (o.getShipState()!=null)   stateCache   = Map.of(o.getShipState().getId(), o.getShipState());
        if (o.getShipDistrict()!=null)districtCache= Map.of(o.getShipDistrict().getId(), o.getShipDistrict());
        return toLite(o);
    }

    private OrderLiteDto toLite(Order o) {
        OrderLiteDto d = new OrderLiteDto();
        d.setId(o.getId());
        d.setPublicCode(o.getPublicCode());
        d.setCustomerId(o.getCustomerId());
        d.setStatus(o.getStatus() != null ? o.getStatus().name() : OrderStatus.ORDERED.name());
        d.setItemsSubtotal(nzd(o.getItemsSubtotal()));
        d.setShippingFee(nzd(o.getShippingFee()));
        d.setDiscountTotal(nzd(o.getDiscountTotal()));
        d.setGrandTotal(nzd(o.getGrandTotal()));
        d.setCurrency(o.getCurrency());
        d.setOrderNotes(o.getOrderNotes());

        d.setShipName(o.getShipName());
        d.setShipPhone(o.getShipPhone());
        d.setShipLine1(o.getShipLine1());
        d.setShipLine2(o.getShipLine2());
        d.setShipPincode(o.getShipPincode());
        d.setCreatedDate(o.getCreatedAt());

        // NEW: pass partner & tracking fields to FE
        d.setDeliveryPartnerId(o.getDeliveryPartnerId());
        d.setCourierName(o.getCourierName());
        d.setTrackingNumber(o.getTrackingNumber());


        if (o.getDeliveryPartnerId()!=null){
            DeliveryPartner deliveryPartner = deliveryPartnerRepository.findById(o.getDeliveryPartnerId()).orElseThrow(() -> new IllegalArgumentException("Delivery Partner not found: " + o.getDeliveryPartnerId()));
            d.setTrackingUrl(deliveryPartner.getTrackingUrlTemplate());
        } else {d.setTrackingUrl(o.getTrackingUrl());}

        CouponRedemption couponRedemption=couponRedemptionRepository.findByOrder_IdAndActiveTrue(o.getId());

        if(couponRedemption!=null){
        d.setCouponId(couponRedemption.getCoupon().getId());
        d.setCouponCode(couponRedemption.getCoupon().getCode());}

        if (o.getShipCountry()!=null) {
            Country c = countryCache.getOrDefault(o.getShipCountry().getId(), o.getShipCountry());
            d.setShipCountryId(c.getId());
            d.setShipCountryName(c.getName());
        }
        if (o.getShipState()!=null) {
            State s = stateCache.getOrDefault(o.getShipState().getId(), o.getShipState());
            d.setShipStateId(s.getId());
            d.setShipStateName(s.getName());
        }
        if (o.getShipDistrict()!=null) {
            District di = districtCache.getOrDefault(o.getShipDistrict().getId(), o.getShipDistrict());
            d.setShipDistrictId(di.getId());
            d.setShipDistrictName(di.getName());
        }





        return d;
    }


    // ───────────────────────────── Entities → View DTO mappers ─────────────────────────────


    private  List<OrderItemViewWithImage> toOrderItemViewWithImage(Order order){
        List<OrderItem> orderItemList = itemRepo.findByOrder_Id(order.getId());
        List<OrderItemViewWithImage> orderItemViewWithImageList = new ArrayList<>();
        for(OrderItem item:orderItemList)
        {
            OrderItemViewWithImage orderItemViewWithImage = new OrderItemViewWithImage();
            orderItemViewWithImage.setId(item.getId());
            orderItemViewWithImage.setQuantity(item.getQuantity());
            orderItemViewWithImage.setLineTotal(item.getLineTotal());
            orderItemViewWithImage.setOptionsText(item.getOptionsText());
            orderItemViewWithImage.setUnitPrice(item.getUnitPrice());
            orderItemViewWithImage.setProductName(item.getProductName());
            orderItemViewWithImage.setProductId(item.getProductId());
            orderItemViewWithImage.setCreatedAt(item.getCreatedAt());
            orderItemViewWithImage.setUrl(catalogService.listProductImageResponses(item.getProductId()).stream().findFirst().get().getUrl());
            orderItemViewWithImageList.add(orderItemViewWithImage);
        }
        return orderItemViewWithImageList;
    }
    private static OrderItemView toView(OrderItem it){
        OrderItemView v = new OrderItemView();
        v.setId(it.getId());
        v.setProductId(it.getProductId());
        v.setProductName(it.getProductName());
        v.setQuantity(it.getQuantity());
        v.setUnitPrice(nzd(it.getUnitPrice()));
        v.setLineTotal(nzd(it.getLineTotal()));
        v.setOptionsText(it.getOptionsText());
        v.setCreatedAt(it.getCreatedAt());
        return v;
    }

    private static PaymentView toView(Payment p){
        PaymentView v = new PaymentView();
        v.setId(p.getId());
        //v.setGateway(p.getGateway());
        v.setRef(p.getRzpPaymentId()); // or external ref
        v.setAmount(nzd(p.getAmount()));
        v.setCurrency(p.getCurrency());
        v.setStatus(p.getStatus()!=null ? p.getStatus().name() : null);
        v.setCreatedAt(p.getCreatedAt());
        return v;
    }

    private static OrderEventView toView(OrderEvent e){
        OrderEventView v = new OrderEventView();
        v.setId(e.getId());
        v.setType(e.getEventType());
        v.setMessage(e.getNote());
        v.setCreatedAt(e.getCreatedAt());
        return v;
    }

    // ───────────────────────────── Simple passthroughs (if still needed) ─────────────────────────────

    public Optional<Order> getByPublicCode(String anyPublicCode) {
        String bare = normalizePublicCode(anyPublicCode);
        return orderRepo.findByPublicCode(bare);
    }

    public List<Order> listByCustomer(Long customerId) {
        if (customerId == null) throw new IllegalArgumentException("customerId is required");
        return orderRepo.findByCustomerIdOrderByIdDesc(customerId);
    }

    public Page<Order> listAll(int page, int size, String sort, String dir) {
        String sortField = (sort == null || sort.isBlank()) ? "id" : sort;
        Sort.Direction direction = Sort.Direction.fromOptionalString(dir).orElse(Sort.Direction.DESC);
        return orderRepo.findAll(PageRequest.of(page, size, Sort.by(direction, sortField)));
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Payment recordPayment(Long orderId, PaymentDto dto) {
        if (orderId == null || dto == null) throw new IllegalArgumentException("orderId and PaymentDto are required");
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
        //p.setCreatedAt(OffsetDateTime.now());
        //p.setCreatedBy(dto.getCreatedBy());
        //p.setModifiedAt(p.getCreatedAt());
        //p.setModifiedBy(p.getCreatedBy());
        paymentRepo.save(p);

        if (dto.getStatus() == PaymentStatus.CAPTURED) {
            order.setPaidAt(OffsetDateTime.now());
            orderRepo.save(order);
        }

        OrderEvent ev = new OrderEvent();
        ev.setOrder(order);
        ev.setEventType("PAYMENT_" + dto.getStatus().name());
        ev.setNote("RZP order=" + dto.getRzpOrderId() + ", payment=" + dto.getRzpPaymentId());
        eventRepo.save(ev);

        return p;
    }

    // ───────────────────────────── View DTOs ─────────────────────────────

    @Data public static class OrderLiteDto {
        private Long id;
        private String publicCode;
        private Long customerId;
        private String status;

        private BigDecimal itemsSubtotal;
        private BigDecimal shippingFee;
        private BigDecimal discountTotal;
        private BigDecimal grandTotal;
        private String currency;

        private String shipName;
        private String shipPhone;
        private String shipLine1;
        private String shipLine2;
        private String shipPincode;

        private Long   shipCountryId;  private String shipCountryName;
        private Long   shipStateId;    private String shipStateName;
        private Long   shipDistrictId; private String shipDistrictName;
        private LocalDateTime createdDate;

        // --- NEW: expose partner + tracking details for FE ---
        private Long   deliveryPartnerId;   // used by FE to fetch partner config/template
        private String courierName;         // display-only
        private String trackingNumber;      // prefill in UI
        private String trackingUrl;         // prefill / preview in UI (may be empty if template-based)
        private Long couponId;
        private String couponCode;
        private String orderNotes;
    }


    @Data public static class OrderItemView {
        private Long id;
        private Long productId;
        private String productName;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal lineTotal;
        private String optionsText;
        private LocalDateTime createdAt;

    }
    @Data public static class OrderItemViewWithImage {
        private Long id;
        private Long productId;
        private String productName;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal lineTotal;
        private String optionsText;
        private LocalDateTime createdAt;
        private String url;

    }

    @Data public static class PaymentView {
        private Long id;
        private String gateway;
        private String ref;
        private BigDecimal amount;
        private String currency;
        private String status;
        private LocalDateTime createdAt;
    }

    @Data public static class OrderEventView {
        private Long id;
        private String type;
        private String message;
        private LocalDateTime createdAt;
    }
}
