package com.blossombuds.service;

/** Sends transactional WhatsApp template messages for order lifecycle events. */
public interface WhatsAppTransactionalService {

    /** Sends order confirmation to the customer's WhatsApp. */
    /**
     * Sends the order_confirmation template.
     *
     * The Meta-approved body takes three variables — name, order code and total paid — and supplies
     * the "BB" prefix itself (`*Order:* BB{{2}}`), so pass the bare code.
     */
    void sendOrderConfirmation(String phone, String customerName, String orderCode,
                               java.math.BigDecimal grandTotal, String currency);

    /** Sends dispatched notification with tracking number and URL. */
    void sendOrderDispatched(String phone, String customerName, String orderCode,
                             String trackingNumber, String trackingUrl);

    /** Sends delivered notification with a review link. */
    void sendOrderDelivered(String phone, String customerName, String orderCode,
                            String reviewUrl);
}
