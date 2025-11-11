package com.blossombuds.dto;

import com.blossombuds.domain.OrderStatus;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** DTO for creating/returning an order (publicCode is YYNNNN). */
@Data
public class OrderDto {
    private Long id;
    private String publicCode;  // store/display: prefix “BB” externally when needed
    private Long customerId;
    private OrderStatus status;

    private BigDecimal itemsSubtotal;
    private BigDecimal shippingFee;
    private BigDecimal discountTotal;
    private BigDecimal grandTotal;
    private String currency;

    private String courierName;
    private String orderNotes;
    private Long deliveryPartnerId;
    private String trackingNumber;
    private String trackingUrl;

    private OffsetDateTime dispatchedAt;
    private OffsetDateTime deliveredAt;
    private OffsetDateTime cancelledAt;
    private OffsetDateTime refundedAt;
    private OffsetDateTime trackingEmailSentAt;
    private OffsetDateTime paidAt;

    private String paymentMethod;
    private String rzpOrderId;
    private String rzpPaymentId;

    /** Optional external payment reference (e.g., UTR / bank txn id). */
    @Size(max = 128)
    private String externalReference;

    private String shipName;
    private String shipPhone;
    private String shipLine1;
    private String shipLine2;
    private Long shipDistrictId;
    private Long shipStateId;
    private String shipPincode;
    private Long shipCountryId;
    private Long CouponId;
    private String CouponCode;

    private Boolean active;
}
