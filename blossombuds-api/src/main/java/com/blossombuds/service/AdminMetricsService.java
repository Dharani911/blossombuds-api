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
    private static final ZoneId BIZ_ZONE = ZoneId.of("Asia/Kolkata");

    private OffsetDateTime nowUtc() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    private OffsetDateTime startOfThisUtc(String bucket) {
        ZonedDateTime now = ZonedDateTime.now(BIZ_ZONE);
        ZonedDateTime startLocal = switch (bucket) {
            case "day" -> now.toLocalDate().atStartOfDay(BIZ_ZONE);
            case "week" -> now.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                    .toLocalDate().atStartOfDay(BIZ_ZONE);
            case "month" -> now.withDayOfMonth(1).toLocalDate().atStartOfDay(BIZ_ZONE);
            case "year" -> now.withDayOfYear(1).toLocalDate().atStartOfDay(BIZ_ZONE);
            default -> now.withDayOfMonth(1).toLocalDate().atStartOfDay(BIZ_ZONE);
        };
        return startLocal.toInstant().atOffset(ZoneOffset.UTC);
    }

    private OffsetDateTime startOfPrevUtc(String bucket) {
        ZonedDateTime now = ZonedDateTime.now(BIZ_ZONE);
        ZonedDateTime startThisLocal = switch (bucket) {
            case "day" -> now.toLocalDate().atStartOfDay(BIZ_ZONE);
            case "week" -> now.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                    .toLocalDate().atStartOfDay(BIZ_ZONE);
            case "month" -> now.withDayOfMonth(1).toLocalDate().atStartOfDay(BIZ_ZONE);
            case "year" -> now.withDayOfYear(1).toLocalDate().atStartOfDay(BIZ_ZONE);
            default -> now.withDayOfMonth(1).toLocalDate().atStartOfDay(BIZ_ZONE);
        };

        ZonedDateTime startPrevLocal = switch (bucket) {
            case "day" -> startThisLocal.minusDays(1);
            case "week" -> startThisLocal.minusWeeks(1);
            case "month" -> startThisLocal.minusMonths(1);
            case "year" -> startThisLocal.minusYears(1);
            default -> startThisLocal.minusMonths(1);
        };

        return startPrevLocal.toInstant().atOffset(ZoneOffset.UTC);
    }
    public MetricsSummary buildSummary() {
        log.info("📊 Building admin metrics summary (calendar-based, IST)");

        OffsetDateTime now = nowUtc();

        OffsetDateTime dayStart = startOfThisUtc("day");
        OffsetDateTime weekStart = startOfThisUtc("week");
        OffsetDateTime monthStart = startOfThisUtc("month");
        OffsetDateTime yearStart = startOfThisUtc("year");

        OffsetDateTime prevDayStart = startOfPrevUtc("day");
        OffsetDateTime prevWeekStart = startOfPrevUtc("week");
        OffsetDateTime prevMonthStart = startOfPrevUtc("month");
        OffsetDateTime prevYearStart = startOfPrevUtc("year");

        long ordersTotal = metricsRepo.countOrders(null, null);
        long ordersDaily = metricsRepo.countOrders(dayStart, now);
        long ordersWeekly = metricsRepo.countOrders(weekStart, now);
        long ordersMonthly = metricsRepo.countOrders(monthStart, now);
        long ordersYearly = metricsRepo.countOrders(yearStart, now);

        long ordersPrevDaily = metricsRepo.countOrders(prevDayStart, dayStart);
        long ordersPrevWeekly = metricsRepo.countOrders(prevWeekStart, weekStart);
        long ordersPrevMonthly = metricsRepo.countOrders(prevMonthStart, monthStart);
        long ordersPrevYearly = metricsRepo.countOrders(prevYearStart, yearStart);

        long revTotal = metricsRepo.sumRevenue(null, null);
        long revDaily = metricsRepo.sumRevenue(dayStart, now);
        long revWeekly = metricsRepo.sumRevenue(weekStart, now);
        long revMonthly = metricsRepo.sumRevenue(monthStart, now);
        long revYearly = metricsRepo.sumRevenue(yearStart, now);

        long revPrevDaily = metricsRepo.sumRevenue(prevDayStart, dayStart);
        long revPrevWeekly = metricsRepo.sumRevenue(prevWeekStart, weekStart);
        long revPrevMonthly = metricsRepo.sumRevenue(prevMonthStart, monthStart);
        long revPrevYearly = metricsRepo.sumRevenue(prevYearStart, yearStart);

        long shipTotal = metricsRepo.sumShipping(null, null);
        long shipDaily = metricsRepo.sumShipping(dayStart, now);
        long shipWeekly = metricsRepo.sumShipping(weekStart, now);
        long shipMonthly = metricsRepo.sumShipping(monthStart, now);
        long shipYearly  = metricsRepo.sumShipping(yearStart, now);

        long shipPrevDaily = metricsRepo.sumShipping(prevDayStart, dayStart);
        long shipPrevWeekly = metricsRepo.sumShipping(prevWeekStart, weekStart);
        long shipPrevMonthly = metricsRepo.sumShipping(prevMonthStart, monthStart);
        long shipPrevYearly  = metricsRepo.sumShipping(prevYearStart, yearStart);

        long shipMax = metricsRepo.maxShippingMonth(yearStart, null);

        long prodTotal = metricsRepo.countProducts();
        long custTotal = metricsRepo.countCustomers();

        long custDaily = metricsRepo.countNewCustomers(dayStart, now);
        long custWeekly = metricsRepo.countNewCustomers(weekStart, now);
        long custMonthly = metricsRepo.countNewCustomers(monthStart, now);
        long custYearly = metricsRepo.countNewCustomers(yearStart, now);

        long custPrevDaily = metricsRepo.countNewCustomers(prevDayStart, dayStart);
        long custPrevWeekly = metricsRepo.countNewCustomers(prevWeekStart, weekStart);
        long custPrevMonthly = metricsRepo.countNewCustomers(prevMonthStart, monthStart);
        long custPrevYearly = metricsRepo.countNewCustomers(prevYearStart, yearStart);

        return MetricsSummary.builder()
                .orders(MetricsSummary.Section.builder()
                        .total(ordersTotal).daily(ordersDaily).weekly(ordersWeekly).monthly(ordersMonthly).yearly(ordersYearly)
                        .prevDaily(ordersPrevDaily).prevWeekly(ordersPrevWeekly).prevMonthly(ordersPrevMonthly).prevYearly(ordersPrevYearly)
                        .build())
                .revenue(MetricsSummary.Section.builder()
                        .total(revTotal).daily(revDaily).weekly(revWeekly).monthly(revMonthly).yearly(revYearly)
                        .prevDaily(revPrevDaily).prevWeekly(revPrevWeekly).prevMonthly(revPrevMonthly).prevYearly(revPrevYearly)
                        .build())
                .shipping(MetricsSummary.Shipping.builder()
                        .total(shipTotal).daily(shipDaily).weekly(shipWeekly).monthly(shipMonthly).yearly(shipYearly)
                        .prevDaily(shipPrevDaily).prevWeekly(shipPrevWeekly).prevMonthly(shipPrevMonthly).prevYearly(shipPrevYearly)
                        .max(shipMax)
                        .build())
                .products(MetricsSummary.Products.builder().total(prodTotal).build())
                .customers(MetricsSummary.Customers.builder()
                        .total(custTotal)
                        .daily(custDaily).weekly(custWeekly).monthly(custMonthly).yearly(custYearly)
                        .prevDaily(custPrevDaily).prevWeekly(custPrevWeekly).prevMonthly(custPrevMonthly).prevYearly(custPrevYearly)
                        .max(custTotal)
                        .build())
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

    private String normalizeBucket(String bucket) {
        String key = (bucket == null ? "month" : bucket.trim().toLowerCase());
        return switch (key) {
            case "today", "daily", "d", "24h" -> "day";
            case "weekly", "7d"               -> "week";
            case "monthly", "30d"             -> "month";
            case "yearly", "12m"              -> "year";
            default -> key; // allow "day/week/month/year"
        };
    }

    private OffsetDateTime startOfRange(String bucket) {
        String b = normalizeBucket(bucket);
        return startOfThisUtc(b); // ✅ IST calendar start converted to UTC
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
