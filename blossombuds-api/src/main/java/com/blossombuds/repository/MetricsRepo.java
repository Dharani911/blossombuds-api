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
    FROM orders o
    WHERE o.status NOT IN ('CANCELLED')
      AND o.created_at >= COALESCE(:fromTs, '-infinity')::timestamptz
      AND o.created_at <  COALESCE(:toTs,   'infinity')::timestamptz
    """, nativeQuery = true)
    long countOrders(@Param("fromTs") OffsetDateTime from, @Param("toTs") OffsetDateTime to);

    // Revenue sum (grand_total) in optional window
    @Query(value = """
    SELECT COALESCE(SUM(o.grand_total),0)
    FROM orders o
    WHERE o.status NOT IN ('CANCELLED')
      AND o.created_at >= COALESCE(:fromTs, '-infinity')::timestamptz
      AND o.created_at <  COALESCE(:toTs,   'infinity')::timestamptz
    """, nativeQuery = true)
    long sumRevenue(@Param("fromTs") OffsetDateTime from, @Param("toTs") OffsetDateTime to);

    // Shipping sum (shipping_fee) in optional window
    @Query(value = """
    SELECT COALESCE(SUM(o.shipping_fee),0)
    FROM orders o
    WHERE o.status NOT IN ('CANCELLED')
      AND o.created_at >= COALESCE(:fromTs, '-infinity')::timestamptz
      AND o.created_at <  COALESCE(:toTs,   'infinity')::timestamptz
    """, nativeQuery = true)
    long sumShipping(@Param("fromTs") OffsetDateTime from, @Param("toTs") OffsetDateTime to);

    // Max monthly shipping (shipping_fee) in optional window
    @Query(value = """
    SELECT COALESCE(MAX(month_sum),0) FROM (
      SELECT DATE_TRUNC('month', o.created_at) m, SUM(o.shipping_fee) month_sum
      FROM orders o
      WHERE o.status NOT IN ('CANCELLED')
        AND o.created_at >= COALESCE(:fromTs, '-infinity')::timestamptz
        AND o.created_at <  COALESCE(:toTs,   'infinity')::timestamptz
      GROUP BY 1
    ) x
    """, nativeQuery = true)
    long maxShippingMonth(@Param("fromTs") OffsetDateTime from, @Param("toTs") OffsetDateTime to);

    @Query(value = "SELECT COALESCE(COUNT(*),0) FROM products p WHERE p.active = true", nativeQuery = true)
    long countProducts();

    @Query(value = "SELECT COALESCE(COUNT(*),0) FROM customers c WHERE c.active = true", nativeQuery = true)
    long countCustomers();

    @Query(value = """
    SELECT COALESCE(COUNT(*),0)
    FROM customers c
    WHERE c.active = true
      AND c.created_at >= COALESCE(:fromTs, '-infinity')::timestamptz
      AND c.created_at <  COALESCE(:toTs,   'infinity')::timestamptz
    """, nativeQuery = true)
    long countNewCustomers(@Param("fromTs") OffsetDateTime from, @Param("toTs") OffsetDateTime to);

    // ---------- Trends (orders + revenue) ----------
    @Query(value = """
        SELECT TO_CHAR(d, 'DD Mon') as label,
               COALESCE(COUNT(o.id),0) AS orders,
               COALESCE(SUM(o.grand_total),0) AS revenue
        FROM (
          SELECT generate_series(DATE_TRUNC('day', NOW()) - INTERVAL '6 days',
                                 DATE_TRUNC('day', NOW()),
                                 INTERVAL '1 day')::timestamp with time zone AS d
        ) days
        LEFT JOIN orders o
          ON DATE_TRUNC('day', o.created_at) = DATE_TRUNC('day', days.d)
         AND o.status NOT IN ('CANCELLED')
        GROUP BY 1, days.d
        ORDER BY days.d
        """, nativeQuery = true)
    List<Object[]> _ordersRevenueByDayRaw();

    @Query(value = """
        SELECT TO_CHAR(DATE_TRUNC('week', o.created_at), '"W"W IW Mon') AS label,
               COUNT(*) AS orders, COALESCE(SUM(o.grand_total),0) AS revenue
        FROM orders o
        WHERE o.status NOT IN ('CANCELLED')
        GROUP BY 1, DATE_TRUNC('week', o.created_at)
        ORDER BY DATE_TRUNC('week', o.created_at) DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> _ordersRevenueByWeekRaw(@Param("limit") int limit);

    @Query(value = """
        SELECT TO_CHAR(DATE_TRUNC('month', o.created_at), 'Mon YYYY') AS label,
               COUNT(*) AS orders, COALESCE(SUM(o.grand_total),0) AS revenue
        FROM orders o
        WHERE o.status NOT IN ('CANCELLED')
        GROUP BY 1, DATE_TRUNC('month', o.created_at)
        ORDER BY DATE_TRUNC('month', o.created_at) DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> _ordersRevenueByMonthRaw(@Param("limit") int limit);

    @Query(value = """
        SELECT TO_CHAR(DATE_TRUNC('year', o.created_at), 'YYYY') AS label,
               COUNT(*) AS orders, COALESCE(SUM(o.grand_total),0) AS revenue
        FROM orders o
        WHERE o.status NOT IN ('CANCELLED')
        GROUP BY 1, DATE_TRUNC('year', o.created_at)
        ORDER BY DATE_TRUNC('year', o.created_at) DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> _ordersRevenueByYearRaw(@Param("limit") int limit);

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

    default List<TrendPoint> ordersRevenueByWeek(int limit) {
        List<Object[]> rowsDesc = _ordersRevenueByWeekRaw(limit);
        List<Object[]> rowsAsc = new ArrayList<>(rowsDesc);
        Collections.reverse(rowsAsc);
        return rowsAsc.stream()
                .map(r -> new TrendPoint(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        ((Number) r[2]).longValue()
                ))
                .collect(Collectors.toList());
    }

    default List<TrendPoint> ordersRevenueByMonth(int limit) {
        List<Object[]> rowsDesc = _ordersRevenueByMonthRaw(limit);
        List<Object[]> rowsAsc = new ArrayList<>(rowsDesc);
        Collections.reverse(rowsAsc);
        return rowsAsc.stream()
                .map(r -> new TrendPoint(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        ((Number) r[2]).longValue()
                ))
                .collect(Collectors.toList());
    }

    default List<TrendPoint> ordersRevenueByYear(int limit) {
        List<Object[]> rowsDesc = _ordersRevenueByYearRaw(limit);
        List<Object[]> rowsAsc = new ArrayList<>(rowsDesc);
        Collections.reverse(rowsAsc);
        return rowsAsc.stream()
                .map(r -> new TrendPoint(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        ((Number) r[2]).longValue()
                ))
                .collect(Collectors.toList());
    }

    // ---------- Shipping / Customers last 12 months ----------
    @Query(value = """
        SELECT TO_CHAR(m, 'Mon') AS label, COALESCE(SUM(o.shipping_fee),0) AS val
        FROM (
          SELECT DATE_TRUNC('month', NOW()) - (s.a || ' months')::interval AS m
          FROM generate_series(0, 11) AS s(a)
        ) months
        LEFT JOIN orders o
          ON DATE_TRUNC('month', o.created_at) = months.m
         AND o.status NOT IN ('CANCELLED')
        GROUP BY 1, months.m
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
        SELECT TO_CHAR(m, 'Mon') AS label, COALESCE(COUNT(c.id),0) AS val
        FROM (
          SELECT DATE_TRUNC('month', NOW()) - (s.a || ' months')::interval AS m
          FROM generate_series(0, 11) AS s(a)
        ) months
        LEFT JOIN customers c
          ON DATE_TRUNC('month', c.created_at) = months.m
         AND c.active = true
        GROUP BY 1, months.m
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
      FROM order_items oi
      JOIN orders o   ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
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
      FROM order_items oi
      JOIN orders o        ON o.id = oi.order_id
      JOIN products p      ON p.id = oi.product_id
      JOIN product_categories pc ON pc.product_id = p.id
      JOIN categories c     ON c.id = pc.category_id
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
