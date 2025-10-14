package com.blossombuds.service;

import com.blossombuds.repository.MetricsRepo;
import com.blossombuds.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import static java.time.temporal.ChronoUnit.DAYS;

@Service
@RequiredArgsConstructor
public class AdminMetricsService {

    private final MetricsRepo metricsRepo;

    public MetricsSummary buildSummary() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        OffsetDateTime dayAgo = now.minusDays(1);
        OffsetDateTime weekAgo = now.minusDays(7);
        OffsetDateTime monthAgo = now.minusMonths(1);
        OffsetDateTime yearAgo = now.minusYears(1);

        long ordersTotal = metricsRepo.countOrders(null, null);
        long ordersDaily = metricsRepo.countOrders(dayAgo, null);
        long ordersWeekly = metricsRepo.countOrders(weekAgo, null);
        long ordersMonthly = metricsRepo.countOrders(monthAgo, null);
        long ordersYearly = metricsRepo.countOrders(yearAgo, null);

        long revTotal = metricsRepo.sumRevenue(null, null);
        long revDaily = metricsRepo.sumRevenue(dayAgo, null);
        long revWeekly = metricsRepo.sumRevenue(weekAgo, null);
        long revMonthly = metricsRepo.sumRevenue(monthAgo, null);
        long revYearly = metricsRepo.sumRevenue(yearAgo, null);

        long shipMonthly = metricsRepo.sumShipping(monthAgo, null);
        long shipYearly  = metricsRepo.sumShipping(yearAgo, null);
        long shipMax     = metricsRepo.maxShippingMonth(yearAgo, null);

        long prodTotal = metricsRepo.countProducts();
        long custTotal = metricsRepo.countCustomers();
        long custMonthly = metricsRepo.countNewCustomers(monthAgo, null);

        return MetricsSummary.builder()
                .orders(new MetricsSummary.Section(ordersTotal, ordersDaily, ordersWeekly, ordersMonthly, ordersYearly))
                .revenue(new MetricsSummary.Section(revTotal, revDaily, revWeekly, revMonthly, revYearly))
                .shipping(new MetricsSummary.Shipping(shipMonthly, shipYearly, shipMax))
                .products(new MetricsSummary.Products(prodTotal))
                .customers(new MetricsSummary.Customers(custTotal, custMonthly, custTotal))
                .build();
    }

    public List<TrendPoint> trend(String range) {
        return switch (range.toLowerCase()) {
            case "weekly"  -> metricsRepo.ordersRevenueByWeek(12);
            case "monthly" -> metricsRepo.ordersRevenueByMonth(12);
            case "yearly"  -> metricsRepo.ordersRevenueByYear(5);
            default        -> metricsRepo.ordersRevenueByDay(7); // daily
        };
    }

    public List<LabeledValue> shipping12m() {
        return metricsRepo.shippingCostByMonth(12);
    }

    public List<LabeledValue> customers12m() {
        return metricsRepo.newCustomersByMonth(12);
    }

    private OffsetDateTime startOfRange(String bucket) {
        ZoneId zone = ZoneId.systemDefault();
        ZonedDateTime now = ZonedDateTime.now(zone);
        return switch (bucket == null ? "month" : bucket.toLowerCase()) {
            case "day" -> now.truncatedTo(DAYS).toOffsetDateTime();
            case "week" -> now.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                    .truncatedTo(DAYS).toOffsetDateTime();
            case "year" -> now.withDayOfYear(1).truncatedTo(DAYS).toOffsetDateTime();
            default /* month */ -> now.withDayOfMonth(1).truncatedTo(DAYS).toOffsetDateTime();
        };
    }
    public List<LabeledValue> topProducts(String range, int limit) {
        OffsetDateTime start = startOfRange(range);
        return metricsRepo.topProductsSince(start, limit);
    }

    public List<LabeledValue> topCategories(String range, int limit) {
        OffsetDateTime start = startOfRange(range);
        return metricsRepo.topCategoriesSince(start, limit);
    }
}
