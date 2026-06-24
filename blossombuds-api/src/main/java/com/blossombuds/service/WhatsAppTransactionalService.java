package com.blossombuds.service;

/** Sends transactional WhatsApp template messages for order lifecycle events. */
public interface WhatsAppTransactionalService {

    /** Sends order confirmation to the customer's WhatsApp. */
    void sendOrderConfirmation(String phone, String customerName, String orderCode);

    /** Sends dispatched notification with tracking number and URL. */
    void sendOrderDispatched(String phone, String customerName, String orderCode,
                             String trackingNumber, String trackingUrl);

    /** Sends delivered notification with a review link. */
    void sendOrderDelivered(String phone, String customerName, String orderCode,
                            String reviewUrl);
}
