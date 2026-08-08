package com.blossombuds.service;

import com.blossombuds.domain.Product;
import com.blossombuds.domain.ProductOption;
import com.blossombuds.domain.ProductOptionValue;
import com.blossombuds.dto.GlobalSaleConfigDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.repository.ProductOptionRepository;
import com.blossombuds.repository.ProductOptionValueRepository;
import com.blossombuds.repository.ProductRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Server-authoritative pricing for checkout.
 *
 * <p>The chargeable price of a line is resolved entirely from the database — never from the
 * request body. The client may lie about {@code unitPrice}, {@code lineTotal}, or the order
 * {@code itemsSubtotal}; none of those are read here.
 *
 * <p>Pricing model (mirrors the storefront's CartProvider exactly, confirmed with the business):
 * <ul>
 *   <li>The product's {@link Product#getPrice()} base price is the default.</li>
 *   <li>A <b>selected</b> option value that carries a price overrides the base with its
 *       {@code priceDelta}, an <b>absolute</b> price (not an add-on). A selected value with no
 *       price of its own — e.g. a colour — keeps the base price. If more than one selected value
 *       is priced, the last one (in option sort order) wins, exactly as the storefront resolves it.</li>
 *   <li>Options flagged {@code required} must have a selection. This is what stops a bypassed
 *       request from paying the base "from" price on a product whose real price lives in a
 *       required option, without rejecting a legitimate unpriced (colour) selection.</li>
 *   <li>The active global sale is applied to the resolved price unless the product is flagged
 *       {@code excludeFromGlobalDiscount}.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckoutPricingService {

    private static final BigDecimal HUNDRED = new BigDecimal("100.00");

    private final ProductRepository productRepo;
    private final ProductOptionRepository optionRepo;
    private final ProductOptionValueRepository valueRepo;
    private final GlobalSaleConfigService globalSaleConfigService;

    /** Result of pricing a whole cart, with all figures derived server-side. */
    @Getter
    public static class PricedCart {
        /** Sum of pre-sale unit prices × quantities. */
        private final BigDecimal originalSubtotal;
        /** Sum of post-sale unit prices × quantities (what the sale actually charges before coupon). */
        private final BigDecimal finalSubtotal;

        PricedCart(BigDecimal originalSubtotal, BigDecimal finalSubtotal) {
            this.originalSubtotal = originalSubtotal;
            this.finalSubtotal = finalSubtotal;
        }

        /** Discount the active sale is responsible for (original − final), never negative. */
        public BigDecimal saleDiscount() {
            BigDecimal d = originalSubtotal.subtract(finalSubtotal);
            return d.signum() < 0 ? BigDecimal.ZERO : d.setScale(2, RoundingMode.HALF_UP);
        }
    }

    /**
     * Prices every line from the catalogue and, as a side effect, overwrites each item's
     * {@code unitPrice} and {@code lineTotal} with the authoritative post-sale values so the
     * persisted order matches what the customer is charged.
     *
     * @throws IllegalArgumentException on any tampering or invalid selection (surfaces as 400)
     */
    @Transactional(readOnly = true)
    public PricedCart priceCart(List<OrderItemDto> items) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Your cart is empty.");
        }

        GlobalSaleConfigDto sale = globalSaleConfigService.getEffectiveNowOrNull();
        BigDecimal salePct = (sale != null && Boolean.TRUE.equals(sale.getEnabled())
                && isValidPercent(sale.getPercentOff())) ? sale.getPercentOff() : null;

        BigDecimal originalSubtotal = BigDecimal.ZERO;
        BigDecimal finalSubtotal = BigDecimal.ZERO;

        for (OrderItemDto it : items) {
            if (it == null) {
                throw new IllegalArgumentException("Invalid cart item.");
            }
            Long productId = it.getProductId();
            if (productId == null) {
                throw new IllegalArgumentException("Invalid item: missing productId.");
            }
            int qty = (it.getQuantity() == null) ? 0 : it.getQuantity();
            if (qty < 1) {
                throw new IllegalArgumentException("Invalid quantity for productId=" + productId);
            }

            // @Where(active=true) means an inactive/soft-deleted product never loads.
            Product p = productRepo.findById(productId)
                    .orElseThrow(() -> new IllegalArgumentException("Product unavailable."));

            if (Boolean.FALSE.equals(p.getVisible()) || Boolean.FALSE.equals(p.getInStock())) {
                throw new IllegalArgumentException("Product unavailable: " + p.getName());
            }

            BigDecimal unitOriginal = resolveUnitPrice(p, it.getSelectedValueIds());
            BigDecimal unitFinal = Boolean.TRUE.equals(p.getExcludeFromGlobalDiscount())
                    ? unitOriginal
                    : applyPercentOff(unitOriginal, salePct);

            BigDecimal qtyBd = BigDecimal.valueOf(qty);
            originalSubtotal = originalSubtotal.add(unitOriginal.multiply(qtyBd));
            finalSubtotal = finalSubtotal.add(unitFinal.multiply(qtyBd));

            // Overwrite client-supplied money with authoritative values.
            it.setProductName(p.getName());
            it.setUnitPrice(unitFinal);
            it.setLineTotal(unitFinal.multiply(qtyBd).setScale(2, RoundingMode.HALF_UP));
        }

        originalSubtotal = originalSubtotal.setScale(2, RoundingMode.HALF_UP);
        finalSubtotal = finalSubtotal.setScale(2, RoundingMode.HALF_UP);

        log.info("[CHECKOUT][PRICE] lines={} originalSubtotal={} finalSubtotal={} saleActive={}",
                items.size(), originalSubtotal, finalSubtotal, salePct != null);

        return new PricedCart(originalSubtotal, finalSubtotal);
    }

    /**
     * Resolves the pre-sale unit price, mirroring the storefront's CartProvider:
     * base price by default, overridden by any selected option value that carries a price
     * (last priced selection wins, in option sort order). Unpriced selections keep the base.
     * Required options must have a selection — the only rejection an honest cart could ever hit,
     * and only if the product's options changed after the item was added.
     */
    private BigDecimal resolveUnitPrice(Product p, List<Long> selectedValueIds) {
        java.util.Set<Long> selected = new java.util.HashSet<>();
        if (selectedValueIds != null) {
            for (Long id : selectedValueIds) if (id != null) selected.add(id);
        }

        BigDecimal unit = p.getPrice(); // base is the default; may be overridden below
        java.util.Set<Long> knownValueIds = new java.util.HashSet<>();

        // Iterate options in the same order the storefront does so a multi-priced override
        // resolves to the same value (last one wins).
        for (ProductOption opt : optionRepo.findByProduct_IdOrderBySortOrderAscIdAsc(p.getId())) {
            if (Boolean.FALSE.equals(opt.getVisible())) continue; // storefront ignores hidden options

            ProductOptionValue chosen = null;
            for (ProductOptionValue v : valueRepo.findByOption_IdOrderBySortOrderAscIdAsc(opt.getId())) {
                knownValueIds.add(v.getId());
                if (selected.contains(v.getId())) chosen = v;
            }

            if (Boolean.TRUE.equals(opt.getRequired()) && chosen == null) {
                throw new IllegalArgumentException("Please select an option for \"" + p.getName() + "\".");
            }
            if (chosen != null && chosen.getPriceDelta() != null) {
                unit = chosen.getPriceDelta(); // this value's absolute price overrides the base
            }
        }

        // Every selected value must belong to this product (anti-tamper). The storefront can only
        // ever select this product's own visible values, so an honest cart never trips this.
        for (Long id : selected) {
            if (!knownValueIds.contains(id)) {
                throw new IllegalArgumentException(
                        "A selected option for \"" + p.getName() + "\" is no longer available. Please re-add it to your cart.");
            }
        }

        return sanitize(unit);
    }

    private static BigDecimal sanitize(BigDecimal v) {
        if (v == null || v.signum() < 0) {
            throw new IllegalArgumentException("This item is not available for online purchase.");
        }
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    private static boolean isValidPercent(BigDecimal pct) {
        return pct != null
                && pct.compareTo(BigDecimal.ZERO) > 0
                && pct.compareTo(HUNDRED) < 0;
    }

    /** final = original × (100 − percent) / 100, rounded to paise. Mirrors CatalogService. */
    private static BigDecimal applyPercentOff(BigDecimal original, BigDecimal percentOff) {
        if (original == null) original = BigDecimal.ZERO;
        if (!isValidPercent(percentOff)) return original.setScale(2, RoundingMode.HALF_UP);
        BigDecimal factor = HUNDRED.subtract(percentOff).divide(HUNDRED, 6, RoundingMode.HALF_UP);
        return original.multiply(factor).setScale(2, RoundingMode.HALF_UP);
    }
}
