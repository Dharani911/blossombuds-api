package com.blossombuds.web;

import com.blossombuds.service.DeliveryFeeRulesService;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

/** Shipping fee quotes for checkout/address pages. */
@RestController
@RequestMapping("/api/shipping")
@RequiredArgsConstructor
@Validated
public class ShippingController {

    private final DeliveryFeeRulesService deliveryFeeService;

    /**
     * Quote delivery fee given subtotal + (stateId, districtId).
     * If subtotal >= settings.shipping.free_threshold → 0;
     * else uses effective fee (district → state → default).
     */
    @GetMapping("/quote")
    public Map<String, Object> quote(
            @RequestParam @PositiveOrZero BigDecimal itemsSubtotal,
            @RequestParam(required = false) @Min(1) Long stateId,
            @RequestParam(required = false) @Min(1) Long districtId
    ) {
        BigDecimal fee = deliveryFeeService.computeFeeWithThreshold(itemsSubtotal, stateId, districtId);
        return Map.of(
                "itemsSubtotal", itemsSubtotal,
                "stateId", stateId,
                "districtId", districtId,
                "fee", fee
        );
    }
}
