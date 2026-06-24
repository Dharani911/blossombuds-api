package com.blossombuds.service;

import java.math.BigDecimal;

/** Abstraction for all outgoing SMS notifications. */
public interface SmsService {

    /** Sends a signup / email-verification OTP via SMS. */
    void sendSignupOtp(String phone, String otpCode);

    /** Sends a password-reset OTP via SMS. */
    void sendPasswordResetOtp(String phone, String otpCode);

    /** Sends a passwordless login OTP via SMS. */
    void sendLoginOtp(String phone, String otpCode);

    /** Sends an order confirmation summary via SMS. */
    void sendOrderConfirmation(String phone, String customerName,
                               String orderCode, BigDecimal grandTotal, String currency);

    /** Sends a dispatched notification with tracking number and URL via SMS. */
    void sendOrderDispatched(String phone, String customerName,
                             String orderCode, String trackingNumber, String trackingUrl);

    /** Sends a delivery notification with prompt to leave a review via SMS. */
    void sendOrderDelivered(String phone, String customerName, String orderCode);

}
