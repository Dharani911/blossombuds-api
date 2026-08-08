package com.blossombuds.service;

import com.blossombuds.domain.Product;
import com.blossombuds.domain.ProductOption;
import com.blossombuds.domain.ProductOptionValue;
import com.blossombuds.dto.GlobalSaleConfigDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.repository.ProductOptionRepository;
import com.blossombuds.repository.ProductOptionValueRepository;
import com.blossombuds.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the checkout money path. These lock the exact pricing model the storefront uses,
 * so a future change cannot silently reopen C1 (price tampering) or C9 (teaser-price bypass):
 * <ul>
 *   <li>base price by default; a selected option value with its own price overrides it (absolute);</li>
 *   <li>an unpriced option (e.g. colour) keeps the base;</li>
 *   <li>the global sale applies to the resolved price unless the product is excluded;</li>
 *   <li>client-supplied unitPrice/lineTotal are never trusted — they are overwritten;</li>
 *   <li>required options must have a selection; tampered/foreign value ids are rejected.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class CheckoutPricingServiceTest {

    @Mock private ProductRepository productRepo;
    @Mock private ProductOptionRepository optionRepo;
    @Mock private ProductOptionValueRepository valueRepo;
    @Mock private GlobalSaleConfigService globalSaleConfigService;

    private CheckoutPricingService service() {
        return new CheckoutPricingService(productRepo, optionRepo, valueRepo, globalSaleConfigService);
    }

    // ── scaffolding ────────────────────────────────────────────────────────────

    private Product product(long id, String price, boolean excludeFromSale) {
        Product p = new Product();
        p.setId(id);
        p.setName("Product " + id);
        p.setPrice(price == null ? null : new BigDecimal(price));
        p.setActive(true);
        p.setVisible(true);
        p.setInStock(true);
        p.setExcludeFromGlobalDiscount(excludeFromSale);
        return p;
    }

    private Product product(long id, String price) {
        return product(id, price, false);
    }

    private ProductOption option(long id, String name, boolean required, int sortOrder) {
        ProductOption o = new ProductOption();
        o.setId(id);
        o.setName(name);
        o.setRequired(required);
        o.setVisible(true);
        o.setActive(true);
        o.setSortOrder(sortOrder);
        return o;
    }

    private ProductOptionValue value(long id, String priceDelta) {
        ProductOptionValue v = new ProductOptionValue();
        v.setId(id);
        v.setValueLabel("value-" + id);
        v.setPriceDelta(priceDelta == null ? null : new BigDecimal(priceDelta));
        v.setActive(true);
        v.setVisible(true);
        return v;
    }

    private OrderItemDto item(long productId, int qty, Long... selectedValueIds) {
        OrderItemDto it = new OrderItemDto();
        it.setProductId(productId);
        it.setQuantity(qty);
        // client-supplied money the server must ignore
        it.setUnitPrice(new BigDecimal("0.01"));
        it.setLineTotal(new BigDecimal("0.01"));
        if (selectedValueIds.length > 0) it.setSelectedValueIds(List.of(selectedValueIds));
        return it;
    }

    private void noSaleActive() {
        lenient().when(globalSaleConfigService.getEffectiveNowOrNull()).thenReturn(null);
    }

    private void saleActive(String percentOff) {
        lenient().when(globalSaleConfigService.getEffectiveNowOrNull()).thenReturn(
                GlobalSaleConfigDto.builder()
                        .enabled(true)
                        .percentOff(new BigDecimal(percentOff))
                        .label("Sale")
                        .build());
    }

    private void stubProduct(Product p) {
        when(productRepo.findById(p.getId())).thenReturn(Optional.of(p));
    }

    private void stubOptions(long productId, ProductOption... options) {
        when(optionRepo.findByProduct_IdOrderBySortOrderAscIdAsc(productId)).thenReturn(List.of(options));
    }

    private void stubValues(long optionId, ProductOptionValue... values) {
        when(valueRepo.findByOption_IdOrderBySortOrderAscIdAsc(optionId)).thenReturn(List.of(values));
    }

    // ── no options: base price is the real price ────────────────────────────────

    @Test
    void noOptions_chargesBasePrice() {
        noSaleActive();
        stubProduct(product(10, "1200.00"));
        stubOptions(10); // no option groups

        var priced = service().priceCart(List.of(item(10, 2)));

        assertThat(priced.getOriginalSubtotal()).isEqualByComparingTo("2400.00");
        assertThat(priced.getFinalSubtotal()).isEqualByComparingTo("2400.00");
        assertThat(priced.saleDiscount()).isEqualByComparingTo("0.00");
    }

    @Test
    void noOptions_appliesGlobalSaleToBasePrice() {
        saleActive("10");
        stubProduct(product(10, "1200.00"));
        stubOptions(10);

        var priced = service().priceCart(List.of(item(10, 1)));

        assertThat(priced.getOriginalSubtotal()).isEqualByComparingTo("1200.00");
        assertThat(priced.getFinalSubtotal()).isEqualByComparingTo("1080.00"); // 10% off
        assertThat(priced.saleDiscount()).isEqualByComparingTo("120.00");
    }

    @Test
    void excludedProduct_ignoresGlobalSale() {
        saleActive("10");
        stubProduct(product(10, "1200.00", true)); // excludeFromGlobalDiscount
        stubOptions(10);

        var priced = service().priceCart(List.of(item(10, 1)));

        assertThat(priced.getFinalSubtotal()).isEqualByComparingTo("1200.00");
        assertThat(priced.saleDiscount()).isEqualByComparingTo("0.00");
    }

    // ── priced option overrides the base ────────────────────────────────────────

    @Test
    void pricedOption_overridesBaseWithAbsoluteValue() {
        noSaleActive();
        stubProduct(product(42, "1200.00"));           // base is only a "from" teaser
        stubOptions(42, option(1, "Stems", true, 0));
        stubValues(1, value(7, "1200.00"), value(8, "2200.00"), value(9, "3200.00"));

        var priced = service().priceCart(List.of(item(42, 2, 8L))); // 24 stems

        // charged at the option's absolute price, NOT the base teaser
        assertThat(priced.getOriginalSubtotal()).isEqualByComparingTo("4400.00");
    }

    @Test
    void pricedOption_appliesSaleToOptionPrice() {
        saleActive("10");
        stubProduct(product(42, "1200.00"));
        stubOptions(42, option(1, "Stems", true, 0));
        stubValues(1, value(8, "2200.00"));

        var priced = service().priceCart(List.of(item(42, 1, 8L)));

        assertThat(priced.getOriginalSubtotal()).isEqualByComparingTo("2200.00");
        assertThat(priced.getFinalSubtotal()).isEqualByComparingTo("1980.00"); // 10% off 2200
    }

    // ── the colour case the business flagged: unpriced option keeps the base ─────

    @Test
    void unpricedColourOption_keepsBasePrice() {
        noSaleActive();
        stubProduct(product(50, "900.00"));
        stubOptions(50, option(2, "Colour", true, 0));
        stubValues(2, value(11, null), value(12, null)); // colours carry no price

        var priced = service().priceCart(List.of(item(50, 1, 11L))); // red

        assertThat(priced.getOriginalSubtotal()).isEqualByComparingTo("900.00");
    }

    @Test
    void mixedOption_unpricedValueSelected_keepsBase_pricedValueSelected_overrides() {
        noSaleActive();
        // one option group where red has no price but gold does
        Product p = product(60, "900.00");
        ProductOption colour = option(3, "Colour", true, 0);

        when(productRepo.findById(60L)).thenReturn(Optional.of(p));
        when(optionRepo.findByProduct_IdOrderBySortOrderAscIdAsc(60L)).thenReturn(List.of(colour));
        when(valueRepo.findByOption_IdOrderBySortOrderAscIdAsc(3L))
                .thenReturn(List.of(value(20, null), value(21, "2000.00"))); // red=base, gold=₹2000

        // red → base 900
        assertThat(service().priceCart(List.of(item(60, 1, 20L))).getOriginalSubtotal())
                .isEqualByComparingTo("900.00");
        // gold → override 2000
        assertThat(service().priceCart(List.of(item(60, 1, 21L))).getOriginalSubtotal())
                .isEqualByComparingTo("2000.00");
    }

    // ── the C9 bypass: a required priced option cannot be skipped ────────────────

    @Test
    void requiredOptionNotSelected_isRejected() {
        noSaleActive();
        stubProduct(product(42, "1200.00"));
        stubOptions(42, option(1, "Stems", true, 0));
        stubValues(1, value(8, "2200.00"), value(9, "3200.00"));

        assertThatThrownBy(() -> service().priceCart(List.of(item(42, 1)))) // no option sent
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("select an option");
    }

    @Test
    void optionalUnpricedOption_maySkipSelection_chargesBase() {
        noSaleActive();
        stubProduct(product(70, "500.00"));
        stubOptions(70, option(4, "Gift message", false, 0)); // NOT required
        stubValues(4, value(30, null));

        var priced = service().priceCart(List.of(item(70, 1))); // nothing selected

        assertThat(priced.getOriginalSubtotal()).isEqualByComparingTo("500.00");
    }

    // ── anti-tamper ─────────────────────────────────────────────────────────────

    @Test
    void selectedValueNotBelongingToProduct_isRejected() {
        noSaleActive();
        stubProduct(product(42, "1200.00"));
        stubOptions(42, option(1, "Colour", false, 0)); // optional, so the required-guard doesn't fire first
        stubValues(1, value(8, null));

        // 999 is not a value of this product → anti-tamper rejection
        assertThatThrownBy(() -> service().priceCart(List.of(item(42, 1, 999L))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no longer available");
    }

    @Test
    void clientSuppliedUnitPriceAndLineTotalAreOverwritten() {
        noSaleActive();
        stubProduct(product(10, "1200.00"));
        stubOptions(10);

        OrderItemDto it = item(10, 2); // client sent unitPrice/lineTotal = 0.01
        service().priceCart(List.of(it));

        assertThat(it.getUnitPrice()).isEqualByComparingTo("1200.00");
        assertThat(it.getLineTotal()).isEqualByComparingTo("2400.00");
        assertThat(it.getProductName()).isEqualTo("Product 10");
    }

    // ── multi-line + guards ─────────────────────────────────────────────────────

    @Test
    void multipleLines_sumIndependently() {
        noSaleActive();
        stubProduct(product(10, "1200.00"));
        stubOptions(10);
        stubProduct(product(11, "300.00"));
        stubOptions(11);

        var priced = service().priceCart(List.of(item(10, 2), item(11, 3)));

        assertThat(priced.getOriginalSubtotal()).isEqualByComparingTo("3300.00"); // 2400 + 900
    }

    @Test
    void emptyCart_isRejected() {
        assertThatThrownBy(() -> service().priceCart(List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("empty");
    }

    @Test
    void zeroQuantity_isRejected() {
        // rejected on quantity before the product is ever loaded — no stubbing needed
        assertThatThrownBy(() -> service().priceCart(List.of(item(10, 0))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void missingProductId_isRejected() {
        OrderItemDto it = new OrderItemDto();
        it.setQuantity(1);
        assertThatThrownBy(() -> service().priceCart(List.of(it)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("productId");
    }

    @Test
    void outOfStockProduct_isRejected() {
        Product p = product(10, "1200.00");
        p.setInStock(false);
        stubProduct(p);
        assertThatThrownBy(() -> service().priceCart(List.of(item(10, 1))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unavailable");
    }

    @Test
    void unknownProduct_isRejected() {
        when(productRepo.findById(999L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().priceCart(List.of(item(999, 1))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unavailable");
    }
}
