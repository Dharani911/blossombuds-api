package com.blossombuds.web;

import com.blossombuds.domain.DeliveryFeeRules;
import com.blossombuds.service.DeliveryFeeRulesService;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Shipping fee quotes + admin CRUD for delivery fee rules. */
@RestController
@RequestMapping("/api/shipping")
@RequiredArgsConstructor
@Validated
public class ShippingController {

    private final DeliveryFeeRulesService deliveryFeeService;

    /* ============================ Public quote APIs ============================ */

    /**
     * Quote delivery fee given subtotal + (stateId, districtId).
     * If subtotal >= settings.shipping.free_threshold → 0;
     * else uses effective fee (district → state → default).
     */
    @GetMapping("/quote")
    public Map<String, Object> quote(
            @RequestParam(required = false) @PositiveOrZero BigDecimal itemsSubtotal,
            @RequestParam(required = false) @Min(1) Long stateId,
            @RequestParam(required = false) @Min(1) Long districtId
    ) {
        BigDecimal fee = deliveryFeeService.computeFeeWithThreshold(itemsSubtotal, stateId, districtId);
        return Map.of(
                "itemsSubtotal", itemsSubtotal == null ? BigDecimal.ZERO : itemsSubtotal,
                "stateId", stateId,
                "districtId", districtId,
                "fee", fee
        );
    }
    @PostMapping(value = "/preview", consumes = "application/json")
    public ShippingPreviewResponse preview(@RequestBody ShippingPreviewRequest req) {
        BigDecimal subtotal = req.getItemsSubtotal() != null ? req.getItemsSubtotal() : BigDecimal.ZERO;
        Long stateId = req.getStateId();
        Long districtId = req.getDistrictId();

        BigDecimal fee = deliveryFeeService.computeFeeWithThreshold(subtotal, stateId, districtId);
        boolean free = fee == null || fee.signum() == 0;

        ShippingPreviewResponse res = new ShippingPreviewResponse();
        res.setFee(fee != null ? fee : BigDecimal.ZERO);
        res.setFree(free);
        return res;
    }

    @Data public static class ShippingPreviewRequest {
        private BigDecimal itemsSubtotal;
        private Long stateId;
        private Long districtId;
    }
    @Data public static class ShippingPreviewResponse {
        private BigDecimal fee;
        private boolean free;
    }




    /* ============================ DTOs ============================ */


}
