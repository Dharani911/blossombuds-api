package com.blossombuds.repository;

import com.blossombuds.domain.Order;

import com.blossombuds.dto.LabeledValue;
import com.blossombuds.dto.TrendPoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Repository
public interface MetricsRepo extends JpaRepository<Order, Long> {

    // ---------- Totals / Sums ----------
    @Query(value = """
    SELECT COALESCE(COUNT(*),0)
    FROM blossombuds_prod.orders o
    WHERE o.status NOT IN ('CANCELLED')
      AND o.created_at >= COALESCE(:fromTs, '-infinity')::timestamptz
      AND o.created_at <  COALESCE(:toTs,   'infinity')::timestamptz
    """, nativeQuery = true)
    long countOrders(@Param("fromTs") OffsetDateTime from, @Param("toTs") OffsetDateTime to);

    // Revenue sum (grand_total) in optional window
    @Query(value = """
    SELECT COALESCE(SUM(o.grand_total),0)
    FROM blossombuds_prod.orders o
    WHERE o.status NOT IN ('CANCELLED')
      AND o.created_at >= COALESCE(:fromTs, '-infinity')::timestamptz
      AND o.created_at <  COALESCE(:toTs,   'infinity')::timestamptz
    """, nativeQuery = true)
    long sumRevenue(@Param("fromTs") OffsetDateTime from, @Param("toTs") OffsetDateTime to);

    // Shipping sum (shipping_fee) in optional window
    @Query(value = """
    SELECT COALESCE(SUM(o.shipping_fee),0)
    FROM blossombuds_prod.orders o
    WHERE o.status NOT IN ('CANCELLED')
      AND o.created_at >= COALESCE(:fromTs, '-infinity')::timestamptz
      AND o.created_at <  COALESCE(:toTs,   'infinity')::timestamptz
    """, nativeQuery = true)
    long sumShipping(@Param("fromTs") OffsetDateTime from, @Param("toTs") OffsetDateTime to);

    // Max monthly shipping (shipping_fee) in optional window
    @Query(value = """
    SELECT COALESCE(MAX(month_sum),0) FROM (
      SELECT DATE_TRUNC('month', o.created_at) m, SUM(o.shipping_fee) month_sum
      FROM blossombuds_prod.orders o
      WHERE o.status NOT IN ('CANCELLED')
        AND o.created_at >= COALESCE(:fromTs, '-infinity')::timestamptz
        AND o.created_at <  COALESCE(:toTs,   'infinity')::timestamptz
      GROUP BY 1
    ) x
    """, nativeQuery = true)
    long maxShippingMonth(@Param("fromTs") OffsetDateTime from, @Param("toTs") OffsetDateTime to);

    @Query(value = "SELECT COALESCE(COUNT(*),0) FROM blossombuds_prod.products p WHERE p.active = true", nativeQuery = true)
    long countProducts();

    @Query(value = "SELECT COALESCE(COUNT(*),0) FROM blossombuds_prod.customers c WHERE c.active = true", nativeQuery = true)
    long countCustomers();

    @Query(value = """
    SELECT COALESCE(COUNT(*),0)
    FROM blossombuds_prod.customers c
    WHERE c.active = true
      AND c.created_at >= COALESCE(:fromTs, '-infinity')::timestamptz
      AND c.created_at <  COALESCE(:toTs,   'infinity')::timestamptz
    """, nativeQuery = true)
    long countNewCustomers(@Param("fromTs") OffsetDateTime from, @Param("toTs") OffsetDateTime to);

    // ---------- Trends (orders + revenue) ----------
    @Query(value = """
  SELECT TO_CHAR(hours.h, 'HH24:00') AS label,
         COALESCE(COUNT(o.id),0) AS orders,
         COALESCE(SUM(o.grand_total),0) AS revenue
  FROM (
    SELECT generate_series(
      date_trunc('day', (NOW() AT TIME ZONE 'Asia/Kolkata')),
      date_trunc('hour', (NOW() AT TIME ZONE 'Asia/Kolkata')),
      INTERVAL '1 hour'
    ) AS h
  ) hours
  LEFT JOIN blossombuds_prod.orders o
    ON date_trunc('hour', (o.created_at AT TIME ZONE 'Asia/Kolkata')) = hours.h
   AND o.status NOT IN ('CANCELLED')
  GROUP BY 1, hours.h
  ORDER BY hours.h
""", nativeQuery = true)
    List<Object[]> _ordersRevenueByDayRaw();


    @Query(value = """
  SELECT TO_CHAR(days.d, 'Dy DD') AS label,
         COALESCE(COUNT(o.id),0) AS orders,
         COALESCE(SUM(o.grand_total),0) AS revenue
  FROM (
    SELECT generate_series(
      date_trunc('week', (NOW() AT TIME ZONE 'Asia/Kolkata')),
      date_trunc('week', (NOW() AT TIME ZONE 'Asia/Kolkata')) + INTERVAL '6 days',
      INTERVAL '1 day'
    ) AS d
  ) days
  LEFT JOIN blossombuds_prod.orders o
    ON date_trunc('day', (o.created_at AT TIME ZONE 'Asia/Kolkata')) = days.d
   AND o.status NOT IN ('CANCELLED')
  GROUP BY 1, days.d
  ORDER BY days.d
""", nativeQuery = true)
    List<Object[]> _ordersRevenueByWeekRaw();


    @Query(value = """
  SELECT TO_CHAR(days.d, 'DD Mon') AS label,
         COALESCE(COUNT(o.id),0) AS orders,
         COALESCE(SUM(o.grand_total),0) AS revenue
  FROM (
    SELECT generate_series(
      date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')),
      date_trunc('day',   (NOW() AT TIME ZONE 'Asia/Kolkata')),
      INTERVAL '1 day'
    ) AS d
  ) days
  LEFT JOIN blossombuds_prod.orders o
    ON date_trunc('day', (o.created_at AT TIME ZONE 'Asia/Kolkata')) = days.d
   AND o.status NOT IN ('CANCELLED')
  GROUP BY 1, days.d
  ORDER BY days.d
""", nativeQuery = true)
    List<Object[]> _ordersRevenueByMonthRaw();


    @Query(value = """
  SELECT TO_CHAR(months.m, 'Mon') AS label,
         COALESCE(COUNT(o.id),0) AS orders,
         COALESCE(SUM(o.grand_total),0) AS revenue
  FROM (
    SELECT generate_series(
      date_trunc('year',  (NOW() AT TIME ZONE 'Asia/Kolkata')),
      date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')),
      INTERVAL '1 month'
    ) AS m
  ) months
  LEFT JOIN blossombuds_prod.orders o
    ON date_trunc('month', (o.created_at AT TIME ZONE 'Asia/Kolkata')) = months.m
   AND o.status NOT IN ('CANCELLED')
  GROUP BY 1, months.m
  ORDER BY months.m
""", nativeQuery = true)
    List<Object[]> _ordersRevenueByYearRaw();


    default List<TrendPoint> ordersRevenueByDay(int days) {
        // Query returns last 7 days in ascending order already.
        return _ordersRevenueByDayRaw().stream()
                .map(r -> new TrendPoint(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        ((Number) r[2]).longValue()
                ))
                .collect(Collectors.toList());
    }

    default List<TrendPoint> ordersRevenueByWeek(int limitIgnored) {
        return _ordersRevenueByWeekRaw().stream()
                .map(r -> new TrendPoint(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        ((Number) r[2]).longValue()
                ))
                .collect(Collectors.toList());
    }

    default List<TrendPoint> ordersRevenueByMonth(int limitIgnored) {
        return _ordersRevenueByMonthRaw().stream()
                .map(r -> new TrendPoint(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        ((Number) r[2]).longValue()
                ))
                .collect(Collectors.toList());
    }

    default List<TrendPoint> ordersRevenueByYear(int limitIgnored) {
        return _ordersRevenueByYearRaw().stream()
                .map(r -> new TrendPoint(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        ((Number) r[2]).longValue()
                ))
                .collect(Collectors.toList());
    }


    // ---------- Shipping / Customers last 12 months ----------
    @Query(value = """
  SELECT TO_CHAR(months.m, 'Mon') AS label,
         COALESCE(SUM(o.shipping_fee),0) AS val
  FROM (
    SELECT generate_series(
      date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')) - INTERVAL '11 months',
      date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')),
      INTERVAL '1 month'
    ) AS m
  ) months
  LEFT JOIN blossombuds_prod.orders o
    ON date_trunc('month', (o.created_at AT TIME ZONE 'Asia/Kolkata')) = months.m
   AND o.status NOT IN ('CANCELLED')
  GROUP BY months.m
  ORDER BY months.m
""", nativeQuery = true)
    List<Object[]> _shippingByMonth();


    default List<LabeledValue> shippingCostByMonth(int lastN) {
        return _shippingByMonth().stream()
                .map(r -> new LabeledValue(
                        (String) r[0],
                        ((Number) r[1]).longValue()
                ))
                .collect(Collectors.toList());
    }

    @Query(value = """
  SELECT TO_CHAR(months.m, 'Mon') AS label,
         COALESCE(COUNT(c.id),0) AS val
  FROM (
    SELECT generate_series(
      date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')) - INTERVAL '11 months',
      date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')),
      INTERVAL '1 month'
    ) AS m
  ) months
  LEFT JOIN blossombuds_prod.customers c
    ON date_trunc('month', (c.created_at AT TIME ZONE 'Asia/Kolkata')) = months.m
   AND c.active = true
  GROUP BY months.m
  ORDER BY months.m
""", nativeQuery = true)
    List<Object[]> _newCustomersByMonth();


    default List<LabeledValue> newCustomersByMonth(int lastN) {
        return _newCustomersByMonth().stream()
                .map(r -> new LabeledValue(
                        (String) r[0],
                        ((Number) r[1]).longValue()
                ))
                .collect(Collectors.toList());
    }

    // ---------- Top Products / Categories ----------
    // Top products since a start timestamp (no reserved words, no CTE)
    @Query(value = """
      SELECT p.name AS label, COALESCE(SUM(oi.quantity),0) AS val
      FROM blossombuds_prod.order_items oi
      JOIN blossombuds_prod.orders o   ON o.id = oi.order_id
      JOIN blossombuds_prod.products p ON p.id = oi.product_id
      WHERE o.status NOT IN ('CANCELLED')
        AND o.created_at >= :startTs
      GROUP BY p.name
      ORDER BY val DESC, p.name
      LIMIT :limit
      """, nativeQuery = true)
    List<Object[]> _topProductsSince(@Param("startTs") OffsetDateTime startTs,
                                     @Param("limit") int limit);

    default List<LabeledValue> topProductsSince(OffsetDateTime startTs, int limit) {
        return _topProductsSince(startTs, limit).stream()
                .map(r -> new LabeledValue((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }

    /*default List<LabeledValue> topProductsByQty(String bucket, int limit) {
        return _topProductsSince(bucket, limit).stream()
                .map(r -> new LabeledValue(
                        (String) r[0],
                        ((Number) r[1]).longValue()
                ))
                .collect(Collectors.toList());
    }*/

    // Top categories since a start timestamp
    @Query(value = """
      SELECT c.name AS label, COALESCE(SUM(oi.quantity),0) AS val
      FROM blossombuds_prod.order_items oi
      JOIN blossombuds_prod.orders o        ON o.id = oi.order_id
      JOIN blossombuds_prod.products p      ON p.id = oi.product_id
      JOIN blossombuds_prod.product_categories pc ON pc.product_id = p.id
      JOIN blossombuds_prod.categories c     ON c.id = pc.category_id
      WHERE o.status NOT IN ('CANCELLED')
        AND o.created_at >= :startTs
      GROUP BY c.name
      ORDER BY val DESC, c.name
      LIMIT :limit
      """, nativeQuery = true)
    List<Object[]> _topCategoriesSince(@Param("startTs") OffsetDateTime startTs,
                                       @Param("limit") int limit);

    default List<LabeledValue> topCategoriesSince(OffsetDateTime startTs, int limit) {
        return _topCategoriesSince(startTs, limit).stream()
                .map(r -> new LabeledValue((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }

}
