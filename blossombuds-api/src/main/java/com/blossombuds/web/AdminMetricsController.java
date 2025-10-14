package com.blossombuds.web;

import com.blossombuds.dto.*;
import com.blossombuds.service.AdminMetricsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/metrics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminMetricsController {

    private final AdminMetricsService metrics;

    @GetMapping("/summary")
    public MetricsSummary summary() {
        return metrics.buildSummary();
    }

    @GetMapping("/trend")
    public List<TrendPoint> trend(@RequestParam(defaultValue = "daily") String range) {
        return metrics.trend(range);
    }

    @GetMapping("/shipping/12m")
    public List<LabeledValue> shippingLast12Months() {
        return metrics.shipping12m();
    }

    @GetMapping("/customers/12m")
    public List<LabeledValue> customersLast12Months() {
        return metrics.customers12m();
    }

    @GetMapping("/top-products")
    public List<LabeledValue> topProducts(@RequestParam(defaultValue = "daily") String range,
                                          @RequestParam(defaultValue = "6") int limit) {
        return metrics.topProducts(range, limit);
    }

    @GetMapping("/top-categories")
    public List<LabeledValue> topCategories(@RequestParam(defaultValue = "daily") String range,
                                            @RequestParam(defaultValue = "6") int limit) {
        return metrics.topCategories(range, limit);
    }
}
