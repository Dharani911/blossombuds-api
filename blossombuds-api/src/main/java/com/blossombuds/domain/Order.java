package com.blossombuds.domain;

import com.blossombuds.db.GenericPgEnumConverter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Represents a customer order including totals, snapshots and tracking info. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@ToString @EqualsAndHashCode(onlyExplicitlyIncluded = true)
@EntityListeners(AuditingEntityListener.class)
@Entity
@Table(name = "orders")
@SQLDelete(sql = "UPDATE {h-schema}orders SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
public class Order {

    /** Surrogate primary key for orders. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    /** Public short code (YYNNNN) stored in DB; UI shows as "BB" + code. */
    @Column(name = "public_code", length = 6)
    private String publicCode;

    /** FK of the customer who placed the order (entity can be added later). */
    @Column(name = "customer_id")
    private Long customerId;

    /** Lifecycle state of the order (PostgreSQL enum: order_status_enum). */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)          // ← key line: bind as a PG named enum
    @Column(name = "status", columnDefinition = "order_status_enum")
    private OrderStatus status;

    /** Sum of item line totals before shipping/discounts (tax-inclusive). */
    @Column(name = "items_subtotal", precision = 12, scale = 2)
    private BigDecimal itemsSubtotal;

    /** Shipping charge applied to this order. */
    @Column(name = "shipping_fee", precision = 12, scale = 2)
    private BigDecimal shippingFee;

    /** Total discount applied to this order. */
    @Column(name = "discount_total", precision = 12, scale = 2)
    private BigDecimal discountTotal;

    /** Final amount payable/paid. */
    @Column(name = "grand_total", precision = 12, scale = 2)
    private BigDecimal grandTotal;

    /** ISO currency code (e.g., INR). */
    @Column(name = "currency", length = 3)
    private String currency;

    /** Courier name snapshot chosen during checkout. */
    @Column(name = "courier_name", length = 40)
    private String courierName;

    /** Free-text notes captured at checkout. */
    @Column(name = "order_notes", columnDefinition = "text")
    private String orderNotes;

    /** FK to delivery partner (entity already provided). */
    @Column(name = "delivery_partner_id")
    private Long deliveryPartnerId;

    /** Carrier’s tracking number, if any. */
    @Column(name = "tracking_number", length = 80)
    private String trackingNumber;

    /** Direct URL to track this shipment. */
    @Column(name = "tracking_url", columnDefinition = "text")
    private String trackingUrl;

    /** Timestamp when the parcel was dispatched. */
    @Column(name = "dispatched_at")
    private OffsetDateTime dispatchedAt;

    /** Timestamp when the parcel was delivered. */
    @Column(name = "delivered_at")
    private OffsetDateTime deliveredAt;

    /** Timestamp when the order was cancelled. */
    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    /** Timestamp when the order was refunded. */
    @Column(name = "refunded_at")
    private OffsetDateTime refundedAt;

    /** Timestamp when tracking email was sent. */
    @Column(name = "tracking_email_sent_at")
    private OffsetDateTime trackingEmailSentAt;

    /** Timestamp when the order was paid. */
    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    /** Payment method snapshot (e.g., UPI, CARD). */
    @Column(name = "payment_method", length = 40)
    private String paymentMethod;

    /** Razorpay order id snapshot. */
    @Column(name = "rzp_order_id", length = 100)
    private String rzpOrderId;

    /** Razorpay payment id snapshot. */
    @Column(name = "rzp_payment_id", length = 100)
    private String rzpPaymentId;

    /** External payment reference (e.g., UTR / bank txn id). */
    @Column(name = "external_reference", length = 128)
    private String externalReference;

    // --- shipping snapshot ---

    /** Recipient name for shipping. */
    @Column(name = "ship_name", length = 120)
    private String shipName;

    /** Recipient phone for shipping. */
    @Column(name = "ship_phone", length = 20)
    private String shipPhone;

    /** Shipping address line 1. */
    @Column(name = "ship_line1", length = 200)
    private String shipLine1;

    /** Shipping address line 2. */
    @Column(name = "ship_line2", length = 200)
    private String shipLine2;

    /** Shipping district / city (FK: orders.ship_district_id). */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ship_district_id",
            foreignKey = @ForeignKey(name = "fk_order_ship_district"))
    @ToString.Exclude
    private District shipDistrict;

    /** Shipping state / region (FK: orders.ship_state_id). */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ship_state_id",
            foreignKey = @ForeignKey(name = "fk_order_ship_state"))
    @ToString.Exclude
    private State shipState;

    /** Shipping postal code. */
    @Column(name = "ship_pincode", length = 10)
    private String shipPincode;

    /** Shipping country (FK: orders.ship_country_id). */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ship_country_id",
            foreignKey = @ForeignKey(name = "fk_order_ship_country"))
    @ToString.Exclude
    private Country shipCountry;

    // --- audit ---

    /** Soft-visibility flag for this order. */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Username/actor who created this record. */
    @Column(name = "created_by", length = 120)
    @CreatedBy
    private String createdBy;

    /** Timestamp when the record was created. */
    @Column(name = "created_at")
    @CreatedDate
    private LocalDateTime createdAt;

    /** Username/actor who last modified this record. */
    @Column(name = "modified_by", length = 120)
    @LastModifiedBy
    private String modifiedBy;

    /** Timestamp when the record was last modified. */
    @Column(name = "modified_at")
    @LastModifiedDate
    private LocalDateTime modifiedAt;
}
