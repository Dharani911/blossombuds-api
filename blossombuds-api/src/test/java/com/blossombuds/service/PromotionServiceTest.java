package com.blossombuds.service;

import com.blossombuds.domain.Coupon;
import com.blossombuds.domain.CouponRedemption;
import com.blossombuds.domain.Order;
import com.blossombuds.dto.CouponDto;
import com.blossombuds.repository.CouponRedemptionRepository;
import com.blossombuds.repository.CouponRepository;
import com.blossombuds.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PromotionServiceTest {

    @Mock private CouponRepository couponRepo;
    @Mock private CouponRedemptionRepository redemptionRepo;
    @Mock private OrderRepository orderRepo;

    private PromotionService service;

    @BeforeEach
    void setUp() {
        service = new PromotionService(couponRepo, redemptionRepo, orderRepo);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // previewDiscount — discount computation
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void previewDiscount_computesPercentDiscount() {
        when(couponRepo.findByCodeIgnoreCase("SAVE10")).thenReturn(Optional.of(
                percentCoupon(1L, "SAVE10", new BigDecimal("10"), null, null)));

        BigDecimal result = service.previewDiscount("SAVE10", 1L, new BigDecimal("500.00"), 1);

        assertThat(result).isEqualByComparingTo("50.00");  // 10% of 500
    }

    @Test
    void previewDiscount_computesFlatDiscount() {
        when(couponRepo.findByCodeIgnoreCase("FLAT100")).thenReturn(Optional.of(
                flatCoupon(2L, "FLAT100", new BigDecimal("100"), null, null)));

        BigDecimal result = service.previewDiscount("FLAT100", 1L, new BigDecimal("500.00"), 1);

        assertThat(result).isEqualByComparingTo("100.00");
    }

    @Test
    void previewDiscount_flatClamped_whenDiscountExceedsOrderTotal() {
        when(couponRepo.findByCodeIgnoreCase("BIGFLAT")).thenReturn(Optional.of(
                flatCoupon(3L, "BIGFLAT", new BigDecimal("9999"), null, null)));

        BigDecimal result = service.previewDiscount("BIGFLAT", 1L, new BigDecimal("200.00"), 1);

        assertThat(result).isEqualByComparingTo("200.00");  // clamped to order total
    }

    @Test
    void previewDiscount_normalizesCodeToUppercase_beforeRepoLookup() {
        when(couponRepo.findByCodeIgnoreCase("UPPER")).thenReturn(Optional.of(
                percentCoupon(4L, "UPPER", new BigDecimal("10"), null, null)));

        service.previewDiscount("upper", 1L, new BigDecimal("500.00"), 1);

        verify(couponRepo).findByCodeIgnoreCase("UPPER");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // previewDiscount — validation failures
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void previewDiscount_throwsWhenCouponExpired() {
        Coupon c = percentCoupon(5L, "EXPIRED", new BigDecimal("10"), null, null);
        c.setValidTo(OffsetDateTime.now().minusDays(1));
        when(couponRepo.findByCodeIgnoreCase("EXPIRED")).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> service.previewDiscount("EXPIRED", 1L, new BigDecimal("500.00"), 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void previewDiscount_throwsWhenCouponNotYetValid() {
        Coupon c = percentCoupon(6L, "FUTURE", new BigDecimal("10"), null, null);
        c.setValidFrom(OffsetDateTime.now().plusDays(1));
        when(couponRepo.findByCodeIgnoreCase("FUTURE")).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> service.previewDiscount("FUTURE", 1L, new BigDecimal("500.00"), 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not yet valid");
    }

    @Test
    void previewDiscount_throwsWhenGlobalUsageLimitReached() {
        Coupon c = percentCoupon(7L, "LIMIT3", new BigDecimal("10"), null, null);
        c.setUsageLimit(3);
        when(couponRepo.findByCodeIgnoreCase("LIMIT3")).thenReturn(Optional.of(c));
        when(redemptionRepo.countByCoupon_Id(7L)).thenReturn(3L);

        assertThatThrownBy(() -> service.previewDiscount("LIMIT3", 1L, new BigDecimal("500.00"), 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("usage limit");
    }

    @Test
    void previewDiscount_throwsWhenPerCustomerLimitReached() {
        Coupon c = percentCoupon(8L, "ONCE", new BigDecimal("10"), null, null);
        c.setPerCustomerLimit(1);
        when(couponRepo.findByCodeIgnoreCase("ONCE")).thenReturn(Optional.of(c));
        when(redemptionRepo.countByCoupon_IdAndCustomerId(8L, 1L)).thenReturn(1L);

        assertThatThrownBy(() -> service.previewDiscount("ONCE", 1L, new BigDecimal("500.00"), 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Per-customer");
    }

    @Test
    void previewDiscount_throwsWhenOrderTotalBelowMinimum() {
        when(couponRepo.findByCodeIgnoreCase("MIN500")).thenReturn(Optional.of(
                percentCoupon(9L, "MIN500", new BigDecimal("10"), new BigDecimal("500.00"), null)));

        assertThatThrownBy(() -> service.previewDiscount("MIN500", 1L, new BigDecimal("499.99"), 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("minimum");
    }

    @Test
    void previewDiscount_throwsWhenItemsCountBelowMinimum() {
        Coupon c = percentCoupon(10L, "MULTI", new BigDecimal("10"), null, null);
        c.setMinItems(3);
        when(couponRepo.findByCodeIgnoreCase("MULTI")).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> service.previewDiscount("MULTI", 1L, new BigDecimal("500.00"), 2))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("item");
    }

    @Test
    void previewDiscount_throwsOnBlankCode() {
        assertThatThrownBy(() -> service.previewDiscount("  ", 1L, new BigDecimal("500.00"), 1))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(couponRepo);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // applyToOrder
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void applyToOrder_updatesGrandTotal_andRecordsRedemption() {
        when(couponRepo.findByCodeIgnoreCase("DISC10")).thenReturn(Optional.of(
                percentCoupon(11L, "DISC10", new BigDecimal("10"), null, null)));

        Order order = order(1L, "500.00", "50.00", "550.00");
        when(orderRepo.findById(1L)).thenReturn(Optional.of(order));
        when(redemptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CouponRedemption redemption = service.applyToOrder("DISC10", 1L, 1L, "ADMIN");

        // 10% of grandTotal(550) = 55; newGrand = items(500) + ship(50) - disc(55) = 495
        assertThat(order.getDiscountTotal()).isEqualByComparingTo("55.00");
        assertThat(order.getGrandTotal()).isEqualByComparingTo("495.00");
        assertThat(redemption.getAmountApplied()).isEqualByComparingTo("55.00");
        assertThat(redemption.getActive()).isTrue();
        verify(orderRepo).save(order);
    }

    @Test
    void applyToOrder_grandTotalIsNeverNegative_whenFlatDiscountExceedsTotal() {
        when(couponRepo.findByCodeIgnoreCase("HUGE")).thenReturn(Optional.of(
                flatCoupon(12L, "HUGE", new BigDecimal("9999"), null, null)));

        Order order = order(2L, "100.00", "0.00", "100.00");
        when(orderRepo.findById(2L)).thenReturn(Optional.of(order));
        when(redemptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.applyToOrder("HUGE", 2L, 1L, "ADMIN");

        assertThat(order.getGrandTotal()).isEqualByComparingTo("0.00");
    }

    @Test
    void applyToOrder_throwsOnNullOrderId() {
        assertThatThrownBy(() -> service.applyToOrder("CODE", null, 1L, "ADMIN"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("orderId");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // revokeRedemption
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void revokeRedemption_setsActiveFalse() {
        CouponRedemption r = new CouponRedemption();
        r.setId(1L);
        r.setActive(true);
        when(redemptionRepo.findById(1L)).thenReturn(Optional.of(r));

        service.revokeRedemption(1L, "ADMIN");

        assertThat(r.getActive()).isFalse();
    }

    @Test
    void revokeRedemption_throwsOnNullId() {
        assertThatThrownBy(() -> service.revokeRedemption(null, "ADMIN"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void revokeRedemption_throwsWhenNotFound() {
        when(redemptionRepo.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.revokeRedemption(999L, "ADMIN"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // createCoupon — validation
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void createCoupon_throwsOnDuplicateCode() {
        when(couponRepo.existsByCodeIgnoreCase("BBNEW10")).thenReturn(true);

        CouponDto dto = new CouponDto();
        dto.setCode("BBNEW10");
        dto.setDiscountType("PERCENT");
        dto.setDiscountValue(BigDecimal.TEN);

        assertThatThrownBy(() -> service.createCoupon(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void createCoupon_throwsOnNegativeDiscountValue() {
        when(couponRepo.existsByCodeIgnoreCase(anyString())).thenReturn(false);

        CouponDto dto = new CouponDto();
        dto.setCode("NEG");
        dto.setDiscountType("FLAT");
        dto.setDiscountValue(new BigDecimal("-50"));

        assertThatThrownBy(() -> service.createCoupon(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("discountValue");
    }

    @Test
    void createCoupon_throwsWhenValidToBeforeValidFrom() {
        when(couponRepo.existsByCodeIgnoreCase(anyString())).thenReturn(false);

        CouponDto dto = new CouponDto();
        dto.setCode("BADWINDOW");
        dto.setDiscountType("PERCENT");
        dto.setDiscountValue(BigDecimal.TEN);
        dto.setValidFrom(OffsetDateTime.now().plusDays(5));
        dto.setValidTo(OffsetDateTime.now().plusDays(1));

        assertThatThrownBy(() -> service.createCoupon(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("validTo");
    }

    @Test
    void createCoupon_throwsOnInvalidDiscountType() {
        when(couponRepo.existsByCodeIgnoreCase(anyString())).thenReturn(false);

        CouponDto dto = new CouponDto();
        dto.setCode("BADTYPE");
        dto.setDiscountType("BOGUS");
        dto.setDiscountValue(BigDecimal.TEN);

        assertThatThrownBy(() -> service.createCoupon(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("PERCENT or FLAT");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private Coupon percentCoupon(Long id, String code, BigDecimal pct,
                                  BigDecimal minTotal, Integer minItems) {
        Coupon c = new Coupon();
        c.setId(id);
        c.setCode(code);
        c.setDiscountType("PERCENT");
        c.setDiscountValue(pct);
        c.setMinOrderTotal(minTotal);
        c.setMinItems(minItems);
        c.setActive(true);
        c.setVisible(true);
        return c;
    }

    private Coupon flatCoupon(Long id, String code, BigDecimal amount,
                               BigDecimal minTotal, Integer minItems) {
        Coupon c = new Coupon();
        c.setId(id);
        c.setCode(code);
        c.setDiscountType("FLAT");
        c.setDiscountValue(amount);
        c.setMinOrderTotal(minTotal);
        c.setMinItems(minItems);
        c.setActive(true);
        c.setVisible(true);
        return c;
    }

    private Order order(Long id, String items, String shipping, String grand) {
        Order o = new Order();
        o.setId(id);
        o.setCustomerId(1L);
        o.setItemsSubtotal(new BigDecimal(items));
        o.setShippingFee(new BigDecimal(shipping));
        o.setGrandTotal(new BigDecimal(grand));
        return o;
    }
}
