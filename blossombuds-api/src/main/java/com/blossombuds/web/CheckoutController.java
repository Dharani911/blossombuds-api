package com.blossombuds.web;

import com.blossombuds.dto.OrderDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.service.CheckoutService;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Customer checkout start: India → RZP order payload; Intl → WhatsApp URL. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/checkout")
public class CheckoutController {

    private final CheckoutService checkout;

    /** Returns either Razorpay order payload (India) or a WhatsApp URL (international). */
    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @ResponseStatus(HttpStatus.OK)
    public CheckoutResponse start(@Valid @RequestBody CheckoutRequest req) {
        var d = checkout.startCheckout(req.getOrder(), req.getItems());
        CheckoutResponse res = new CheckoutResponse();
        res.setType(d.getType().name());
        res.setCurrency(d.getCurrency());
        res.setRazorpayOrder(d.getRazorpayOrder());
        res.setWhatsappUrl(d.getWhatsappUrl());
        return res;
    }

    // -------- payloads --------
    @Data
    public static class CheckoutRequest {
        @Valid private OrderDto order;
        private List<OrderItemDto> items;
    }
    @Data
    public static class CheckoutResponse {
        /** "RZP_ORDER" or "WHATSAPP" */
        private String type;
        private String currency;                  // when RZP_ORDER
        private Map<String, Object> razorpayOrder;// when RZP_ORDER
        private String whatsappUrl;               // when WHATSAPP
    }
}
