package com.blossombuds.service;

import com.blossombuds.repository.MetricsRepo;
import com.blossombuds.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import static java.time.temporal.ChronoUnit.DAYS;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminMetricsService {

    private final MetricsRepo metricsRepo;

    public MetricsSummary buildSummary() {

        log.info("📊 Building admin metrics summary");

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
        log.debug("📦 Orders: total={}, daily={}, weekly={}, monthly={}, yearly={}",
                ordersTotal, ordersDaily, ordersWeekly, ordersMonthly, ordersYearly);
        log.debug("💰 Revenue: total={}, daily={}, weekly={}, monthly={}, yearly={}",
                revTotal, revDaily, revWeekly, revMonthly, revYearly);
        log.debug("🚚 Shipping: monthly={}, yearly={}, max={}", shipMonthly, shipYearly, shipMax);
        log.debug("🛒 Products: total={}", prodTotal);
        log.debug("👥 Customers: total={}, newMonthly={}", custTotal, custMonthly);


        return MetricsSummary.builder()
                .orders(new MetricsSummary.Section(ordersTotal, ordersDaily, ordersWeekly, ordersMonthly, ordersYearly))
                .revenue(new MetricsSummary.Section(revTotal, revDaily, revWeekly, revMonthly, revYearly))
                .shipping(new MetricsSummary.Shipping(shipMonthly, shipYearly, shipMax))
                .products(new MetricsSummary.Products(prodTotal))
                .customers(new MetricsSummary.Customers(custTotal, custMonthly, custTotal))
                .build();
    }

    public List<TrendPoint> trend(String range) {
        log.info("📈 Fetching trend data for range: {}", range);
        return switch (range.toLowerCase()) {
            case "weekly"  -> metricsRepo.ordersRevenueByWeek(12);
            case "monthly" -> metricsRepo.ordersRevenueByMonth(12);
            case "yearly"  -> metricsRepo.ordersRevenueByYear(5);
            default        -> metricsRepo.ordersRevenueByDay(7); // daily
        };
    }

    public List<LabeledValue> shipping12m() {
        log.info("📦 Fetching shipping cost trend (12 months)");
        return metricsRepo.shippingCostByMonth(12);
    }

    public List<LabeledValue> customers12m() {
        log.info("👥 Fetching new customer trend (12 months)");
        return metricsRepo.newCustomersByMonth(12);
    }

    private OffsetDateTime startOfRange(String bucket) {
        ZoneId zone = ZoneId.systemDefault();
        ZonedDateTime now = ZonedDateTime.now(zone);

        String key = (bucket == null ? "month" : bucket.trim().toLowerCase());

        // 🔁 Normalize aliases from frontend
        switch (key) {
            case "today", "daily", "d", "24h" -> key = "day";
            case "weekly", "7d"      -> key = "week";
            case "monthly", "30d"    -> key = "month";
            case "yearly", "12m"     -> key = "year";
            default -> { /* keep as is: day, week, month, year */ }
        }

        OffsetDateTime start = switch (key) {
            case "day" -> now.truncatedTo(DAYS).toOffsetDateTime();
            case "week" -> now.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                    .truncatedTo(DAYS).toOffsetDateTime();
            case "year" -> now.withDayOfYear(1)
                    .truncatedTo(DAYS).toOffsetDateTime();
            default /* month */ -> now.withDayOfMonth(1)
                    .truncatedTo(DAYS).toOffsetDateTime();
        };

        log.debug("🕒 startOfRange for '{}' (normalized='{}') = {}", bucket, key, start);
        return start;
    }

    public List<LabeledValue> topProducts(String range, int limit) {
        OffsetDateTime start = startOfRange(range);
        log.info("🏆 Fetching top {} products since {} (range={})", limit, start, range);
        return metricsRepo.topProductsSince(start, limit);
    }

    public List<LabeledValue> topCategories(String range, int limit) {
        OffsetDateTime start = startOfRange(range);
        log.info("📚 Fetching top {} categories since {} (range={})", limit, start, range);
        return metricsRepo.topCategoriesSince(start, limit);
    }
}
