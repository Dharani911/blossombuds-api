package com.blossombuds.dto;

import com.blossombuds.domain.PaymentStatus;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** DTO for payment details associated with an order. */
@Data
public class PaymentDto {
    private Long id;
    private Long orderId;
    private PaymentStatus status;
    private BigDecimal amount;
    private String currency;
    private String rzpOrderId;
    private String rzpPaymentId;
    private Boolean active;


}
