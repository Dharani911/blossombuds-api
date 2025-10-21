package com.blossombuds.web;

import com.blossombuds.domain.DeliveryFeeRules;
import com.blossombuds.service.DeliveryFeeRulesService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// Admin rules (auth required)
@RestController
@RequestMapping("/api/admin/shipping/rules")
@RequiredArgsConstructor
public class ShippingRulesAdminController {
    private final DeliveryFeeRulesService deliveryFeeService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<DeliveryFeeRules> list() { return deliveryFeeService.listAllRulesNewestFirst(); }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public DeliveryFeeRules create(@RequestBody DeliveryFeeRules dto) { return deliveryFeeService.createRule(dto); }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public DeliveryFeeRules update(@PathVariable Long id, @RequestBody DeliveryFeeRules dto) {
        return deliveryFeeService.updateRule(id, dto);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long id) { deliveryFeeService.deleteRule(id); }
}

