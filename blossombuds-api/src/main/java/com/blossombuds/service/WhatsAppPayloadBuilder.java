package com.blossombuds.service;

import com.blossombuds.domain.Customer;
import com.blossombuds.dto.OrderDto;
import com.blossombuds.dto.OrderItemDto;
import com.blossombuds.domain.Setting;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** Builds a pre-filled WhatsApp message + link for international orders. */
@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppPayloadBuilder {

    private final SettingsService settings;

    /** Returns a wa.me link with a pre-filled, human-readable cart summary. */
    public String buildForOrderDraft(OrderDto order, List<OrderItemDto> items, Customer customer) {
        String target = getWhatsAppTarget(); // like 9198xxxxxxxx
        String text = buildMessageText(order, items, customer);
        String encoded = URLEncoder.encode(text, StandardCharsets.UTF_8);
        // Works on mobile and desktop web WhatsApp
        String waUrl = "https://wa.me/" + target + "?text=" + encoded;

        log.info("[WHATSAPP][URL] Generated wa.me URL for orderId={} → {}", order != null ? order.getId() : null, waUrl);
        return waUrl;
    }

    private String getWhatsAppTarget() {
        try {
            Setting s = settings.get("support.whatsapp_number");
            String v = s.getValue();
            if (v != null && !v.isBlank()) {
                String cleaned = v.replaceAll("[^0-9]", "");
                log.info("[WHATSAPP][NUMBER] Using WhatsApp number from settings: {}", cleaned);
                return cleaned;
            }
        } catch (Exception e) {
            log.warn("[WHATSAPP][SETTINGS_FAIL] Failed to get WhatsApp number from settings: {}", e.getMessage());
        }
        log.info("[WHATSAPP][FALLBACK] Using fallback WhatsApp number.");
        return "919000000000";
    }

    private String buildMessageText(OrderDto order, List<OrderItemDto> items, Customer c) {
        log.info("[WHATSAPP][MSG_BUILD] Building WhatsApp message for orderId={}", order != null ? order.getId() : null);

        StringBuilder sb = new StringBuilder();
        sb.append("Hello! I'd like to place an international order.\n\n");

        if (c != null) {
            if (c.getName() != null) sb.append("Customer: ").append(c.getName()).append("\n");
            if (c.getEmail() != null) sb.append("Email: ").append(c.getEmail()).append("\n");
            if (c.getPhone() != null) sb.append("Phone: ").append(c.getPhone()).append("\n");
            sb.append("\n");
        }

        sb.append("Items:\n");
        if (items != null && !items.isEmpty()) {
            for (OrderItemDto it : items) {
                sb.append("• ").append(nz(it.getProductName()))
                        .append(" × ").append(String.valueOf(nz(it.getQuantity())))
                        .append(" — ").append(money(it.getUnitPrice(), order.getCurrency()))
                        .append("\n");
                if (it.getOptionsText() != null && !it.getOptionsText().isBlank()) {
                    sb.append("  ").append(it.getOptionsText()).append("\n");
                }
            }
        } else {
            sb.append("• (No items listed)\n");
        }

        sb.append("\nSubtotal: ").append(money(order.getItemsSubtotal(), order.getCurrency())).append("\n");
        if (order.getShippingFee() != null)
            sb.append("Shipping (est.): ").append(money(order.getShippingFee(), order.getCurrency())).append("\n");
        if (order.getDiscountTotal() != null && order.getDiscountTotal().signum() > 0)
            sb.append("Discount: -").append(money(order.getDiscountTotal(), order.getCurrency())).append("\n");
        if (order.getGrandTotal() != null)
            sb.append("Grand Total: ").append(money(order.getGrandTotal(), order.getCurrency())).append("\n");

        sb.append("\nShip To:\n");
        sb.append(nz(order.getShipName())).append("\n");
        sb.append(nz(order.getShipLine1())).append("\n");
        if (order.getShipLine2() != null && !order.getShipLine2().isBlank()) sb.append(order.getShipLine2()).append("\n");
        sb.append(nz(order.getShipPincode())).append("\n");
        sb.append("(City/District/State provided in website)\n");

        sb.append("\nPlease assist me with international shipping. Thank you!");
        return sb.toString();
    }

    private String money(BigDecimal v, String currency) {
        BigDecimal x = v == null ? BigDecimal.ZERO : v;
        String cur = (currency == null || currency.isBlank()) ? "INR" : currency.trim().toUpperCase();
        return cur + " " + x.setScale(2, BigDecimal.ROUND_HALF_UP).toPlainString();
    }
    private String nz(String s) { return s == null ? "" : s; }
    private Integer nz(Integer i) { return i == null ? 0 : i; }
}
