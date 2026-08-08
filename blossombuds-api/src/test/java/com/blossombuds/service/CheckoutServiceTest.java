package com.blossombuds.service;

import com.blossombuds.domain.CheckoutIntent;
import com.blossombuds.domain.Country;
import com.blossombuds.domain.Customer;
import com.blossombuds.domain.Product;
import com.blossombuds.dto.OrderDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.repository.CheckoutIntentRepository;
import com.blossombuds.repository.CountryRepository;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.repository.ProductRepository;
import com.blossombuds.service.payments.RazorpayService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CheckoutServiceTest {

    @Mock private CountryRepository countryRepo;
    @Mock private CustomerRepository customerRepo;
    @Mock private CheckoutIntentRepository ciRepo;
    @Mock private WhatsAppPayloadBuilder waBuilder;
    @Mock private RazorpayService rzpService;
    @Mock private CheckoutTxService checkoutTxService;
    @Mock private ProductRepository productRepo;
    @Mock private SettingsService settingsService;
    @Mock private DeliveryFeeRulesService deliveryFeeService;

    private CheckoutService service;

    @BeforeEach
    void setUp() {
        service = new CheckoutService(
                countryRepo, customerRepo, ciRepo,
                waBuilder, rzpService, checkoutTxService,
                productRepo, settingsService, deliveryFeeService);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // International checkout → WhatsApp URL
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void startCheckout_returnsWhatsappDecision_forNonIndiaCountry() {
        Country us = country("United States");
        when(countryRepo.findById(2L)).thenReturn(Optional.of(us));
        when(productRepo.findById(10L)).thenReturn(Optional.of(product(10L, true, true, true)));
        when(waBuilder.buildForOrderDraft(any(), any(), any())).thenReturn("https://wa.me/...");

        OrderDto draft = draft(2L, "500.00");
        CheckoutService.Decision decision = service.startCheckout(draft, List.of(item(10L)));

        assertThat(decision.getType()).isEqualTo(CheckoutService.Decision.Type.WHATSAPP);
        assertThat(decision.getWhatsappUrl()).isEqualTo("https://wa.me/...");
        verifyNoInteractions(rzpService, checkoutTxService);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // India checkout → Razorpay order
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void startCheckout_returnsRzpDecision_forIndiaCountry() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product p = product(10L, true, true, true);
        when(productRepo.findById(10L)).thenReturn(Optional.of(p));

        // GST disabled so grand total stays predictable
        when(settingsService.safeGet("checkout.gst.enabled")).thenReturn("false");
        when(deliveryFeeService.computeFee(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);

        CheckoutIntent ci = new CheckoutIntent();
        ci.setId(5L);
        when(checkoutTxService.createIntentCommitted(any(), any())).thenReturn(ci);

        Map<String, Object> rzpOrder = Map.of("id", "order_abc123", "amount", 50000L);
        when(rzpService.createRzpOrderForAmount(anyLong(), anyString(), anyString(), any(), anyBoolean()))
                .thenReturn(rzpOrder);

        OrderDto draft = draftIndia("9876543210", "500.00", "0.00");
        CheckoutService.Decision decision = service.startCheckout(draft, List.of(item(10L)));

        assertThat(decision.getType()).isEqualTo(CheckoutService.Decision.Type.RZP_ORDER);
        assertThat(decision.getRazorpayOrder()).containsKey("id");
        verify(checkoutTxService).createIntentCommitted(any(), any());
        verify(checkoutTxService).attachRzpOrderIdCommitted(eq(5L), eq("order_abc123"));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // assertAllItemsInStock — stock/visibility guards
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void startCheckout_throwsWhenProductIsInactive() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product inactive = product(20L, false, true, true);
        when(productRepo.findById(20L)).thenReturn(Optional.of(inactive));

        assertThatThrownBy(() -> service.startCheckout(draftIndia("9876543210", "100.00", "0.00"), List.of(item(20L))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unavailable");
    }

    @Test
    void startCheckout_throwsWhenProductIsNotVisible() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product hidden = product(21L, true, false, true);
        when(productRepo.findById(21L)).thenReturn(Optional.of(hidden));

        assertThatThrownBy(() -> service.startCheckout(draftIndia("9876543210", "100.00", "0.00"), List.of(item(21L))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unavailable");
    }

    @Test
    void startCheckout_throwsWhenProductIsOutOfStock() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product oos = product(22L, true, true, false);
        when(productRepo.findById(22L)).thenReturn(Optional.of(oos));

        assertThatThrownBy(() -> service.startCheckout(draftIndia("9876543210", "100.00", "0.00"), List.of(item(22L))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("stock");
    }

    @Test
    void startCheckout_throwsWhenItemHasNoProductId() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        OrderItemDto noId = new OrderItemDto();
        noId.setProductId(null);

        assertThatThrownBy(() -> service.startCheckout(draftIndia("9876543210", "100.00", "0.00"), List.of(noId)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("productId");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // validateShipPhone — phone guard (India only)
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void startCheckout_throwsWhenShipPhoneBlank() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product p = product(10L, true, true, true);
        when(productRepo.findById(10L)).thenReturn(Optional.of(p));

        OrderDto draft = draftIndia("", "500.00", "0.00");
        assertThatThrownBy(() -> service.startCheckout(draft, List.of(item(10L))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("phone number");
    }

    @Test
    void startCheckout_throwsWhenShipPhoneIsInvalidIndianNumber() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product p = product(10L, true, true, true);
        when(productRepo.findById(10L)).thenReturn(Optional.of(p));

        // starts with 1 — invalid Indian mobile
        OrderDto draft = draftIndia("1234567890", "500.00", "0.00");
        assertThatThrownBy(() -> service.startCheckout(draft, List.of(item(10L))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("valid Indian mobile");
    }

    @Test
    void startCheckout_acceptsValidIndianNumberWithCountryCode() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product p = product(10L, true, true, true);
        when(productRepo.findById(10L)).thenReturn(Optional.of(p));

        when(settingsService.safeGet("checkout.gst.enabled")).thenReturn("false");
        when(deliveryFeeService.computeFee(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);

        CheckoutIntent ci = new CheckoutIntent(); ci.setId(1L);
        when(checkoutTxService.createIntentCommitted(any(), any())).thenReturn(ci);
        when(rzpService.createRzpOrderForAmount(anyLong(), anyString(), anyString(), any(), anyBoolean()))
                .thenReturn(Map.of("id", "order_xyz", "amount", 50000L));

        // 91 prefix + 10-digit valid mobile → should be normalised and accepted
        OrderDto draft = draftIndia("919876543210", "500.00", "0.00");
        CheckoutService.Decision decision = service.startCheckout(draft, List.of(item(10L)));

        assertThat(decision.getType()).isEqualTo(CheckoutService.Decision.Type.RZP_ORDER);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // applyBackendGstTotals — GST computation (via India path)
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void startCheckout_appliesDefaultGstRate10_belowThreshold() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product p = product(10L, true, true, true);
        when(productRepo.findById(10L)).thenReturn(Optional.of(p));

        // GST enabled (default)
        when(settingsService.safeGet("checkout.gst.enabled")).thenReturn("true");
        when(deliveryFeeService.computeFee(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);

        CheckoutIntent ci = new CheckoutIntent(); ci.setId(1L);
        when(checkoutTxService.createIntentCommitted(any(), any())).thenReturn(ci);
        when(rzpService.createRzpOrderForAmount(anyLong(), anyString(), anyString(), any(), anyBoolean()))
                .thenReturn(Map.of("id", "order_1", "amount", 1L));

        // taxable = 1000, below 10000 threshold → rate = 10%
        OrderDto draft = draftIndia("9876543210", "1000.00", "0.00");
        service.startCheckout(draft, List.of(item(10L)));

        // applyBackendGstTotals mutates the draft in-place
        assertThat(draft.getGstRate()).isEqualByComparingTo("10");
        assertThat(draft.getGstAmount()).isEqualByComparingTo("100.00");  // 10% of 1000
        assertThat(draft.getGrandTotal()).isEqualByComparingTo("1100.00"); // 1000 + 100 + 0 shipping
    }

    @Test
    void startCheckout_appliesReducedGstRate8_aboveThreshold() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product p = product(10L, true, true, true);
        when(productRepo.findById(10L)).thenReturn(Optional.of(p));

        when(settingsService.safeGet("checkout.gst.enabled")).thenReturn("true");
        when(deliveryFeeService.computeFee(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);

        CheckoutIntent ci = new CheckoutIntent(); ci.setId(1L);
        when(checkoutTxService.createIntentCommitted(any(), any())).thenReturn(ci);
        when(rzpService.createRzpOrderForAmount(anyLong(), anyString(), anyString(), any(), anyBoolean()))
                .thenReturn(Map.of("id", "order_2", "amount", 1L));

        // taxable = 15000, above 10000 threshold → rate = 8%
        OrderDto draft = draftIndia("9876543210", "15000.00", "0.00");
        service.startCheckout(draft, List.of(item(10L)));

        assertThat(draft.getGstRate()).isEqualByComparingTo("8");
        assertThat(draft.getGstAmount()).isEqualByComparingTo("1200.00");   // 8% of 15000
        assertThat(draft.getGrandTotal()).isEqualByComparingTo("16200.00"); // 15000 + 1200
    }

    @Test
    void startCheckout_appliesZeroGst_whenGstDisabled() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product p = product(10L, true, true, true);
        when(productRepo.findById(10L)).thenReturn(Optional.of(p));

        when(settingsService.safeGet("checkout.gst.enabled")).thenReturn("false");
        when(deliveryFeeService.computeFee(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);

        CheckoutIntent ci = new CheckoutIntent(); ci.setId(1L);
        when(checkoutTxService.createIntentCommitted(any(), any())).thenReturn(ci);
        when(rzpService.createRzpOrderForAmount(anyLong(), anyString(), anyString(), any(), anyBoolean()))
                .thenReturn(Map.of("id", "order_3", "amount", 1L));

        OrderDto draft = draftIndia("9876543210", "2000.00", "0.00");
        service.startCheckout(draft, List.of(item(10L)));

        assertThat(draft.getGstRate()).isEqualByComparingTo("0");
        assertThat(draft.getGstAmount()).isEqualByComparingTo("0.00");
        assertThat(draft.getGrandTotal()).isEqualByComparingTo("2000.00");
    }

    @Test
    void startCheckout_discountReducesTaxableAmount_beforeGstComputation() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product p = product(10L, true, true, true);
        when(productRepo.findById(10L)).thenReturn(Optional.of(p));

        when(settingsService.safeGet("checkout.gst.enabled")).thenReturn("true");
        when(deliveryFeeService.computeFee(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);

        CheckoutIntent ci = new CheckoutIntent(); ci.setId(1L);
        when(checkoutTxService.createIntentCommitted(any(), any())).thenReturn(ci);
        when(rzpService.createRzpOrderForAmount(anyLong(), anyString(), anyString(), any(), anyBoolean()))
                .thenReturn(Map.of("id", "order_4", "amount", 1L));

        // items=1000, discount=200 → taxable=800 → below 10k → rate=10% → gst=80 → grand=880
        OrderDto draft = draftIndia("9876543210", "1000.00", "200.00");
        service.startCheckout(draft, List.of(item(10L)));

        assertThat(draft.getTaxableAmount()).isEqualByComparingTo("800.00");
        assertThat(draft.getGstAmount()).isEqualByComparingTo("80.00");
        assertThat(draft.getGrandTotal()).isEqualByComparingTo("880.00");
    }

    @Test
    void startCheckout_shippingFeeAdded_toGrandTotal() {
        Country india = country("India");
        when(countryRepo.findById(1L)).thenReturn(Optional.of(india));

        Product p = product(10L, true, true, true);
        when(productRepo.findById(10L)).thenReturn(Optional.of(p));

        when(settingsService.safeGet("checkout.gst.enabled")).thenReturn("false");
        when(deliveryFeeService.computeFee(any(), any(), any(), any()))
                .thenReturn(new BigDecimal("100.00"));

        CheckoutIntent ci = new CheckoutIntent(); ci.setId(1L);
        when(checkoutTxService.createIntentCommitted(any(), any())).thenReturn(ci);
        when(rzpService.createRzpOrderForAmount(anyLong(), anyString(), anyString(), any(), anyBoolean()))
                .thenReturn(Map.of("id", "order_5", "amount", 1L));

        // GST off: grand = taxable(500) + shipping(100) = 600
        OrderDto draft = draftIndia("9876543210", "500.00", "0.00");
        service.startCheckout(draft, List.of(item(10L)));

        assertThat(draft.getShippingFee()).isEqualByComparingTo("100.00");
        assertThat(draft.getGrandTotal()).isEqualByComparingTo("600.00");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private Country country(String name) {
        Country c = new Country();
        try {
            c.getClass().getMethod("setName", String.class).invoke(c, name);
        } catch (Exception e) {
            // If Country uses a different setter pattern, try field injection
            try {
                var f = c.getClass().getDeclaredField("name");
                f.setAccessible(true);
                f.set(c, name);
            } catch (Exception ex) {
                throw new RuntimeException("Cannot set Country.name", ex);
            }
        }
        return c;
    }

    private Product product(Long id, boolean active, boolean visible, boolean inStock) {
        Product p = new Product();
        try {
            var idF = p.getClass().getDeclaredField("id");
            idF.setAccessible(true);
            idF.set(p, id);
            var aF = p.getClass().getDeclaredField("active");
            aF.setAccessible(true);
            aF.set(p, active);
            var vF = p.getClass().getDeclaredField("visible");
            vF.setAccessible(true);
            vF.set(p, visible);
            var sF = p.getClass().getDeclaredField("inStock");
            sF.setAccessible(true);
            sF.set(p, inStock);
            var nF = p.getClass().getDeclaredField("name");
            nF.setAccessible(true);
            nF.set(p, "Product " + id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return p;
    }

    private OrderDto draft(Long countryId, String itemsSubtotal) {
        OrderDto d = new OrderDto();
        d.setShipCountryId(countryId);
        d.setCustomerId(1L);
        d.setItemsSubtotal(new BigDecimal(itemsSubtotal));
        d.setDiscountTotal(BigDecimal.ZERO);
        d.setCurrency("INR");
        return d;
    }

    private OrderDto draftIndia(String phone, String itemsSubtotal, String discount) {
        OrderDto d = new OrderDto();
        d.setShipCountryId(1L);
        d.setCustomerId(1L);
        d.setShipPhone(phone);
        d.setItemsSubtotal(new BigDecimal(itemsSubtotal));
        d.setDiscountTotal(new BigDecimal(discount));
        d.setCurrency("INR");
        return d;
    }

    private OrderItemDto item(Long productId) {
        OrderItemDto it = new OrderItemDto();
        it.setProductId(productId);
        it.setQuantity(1);
        it.setUnitPrice(new BigDecimal("500.00"));
        it.setLineTotal(new BigDecimal("500.00"));
        return it;
    }
}
