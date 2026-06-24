package com.blossombuds.service;

import java.math.BigDecimal;

/** Abstraction for all outgoing emails. */
public interface EmailService {

    /** Sends an email verification link to a customer. */
    void sendVerificationEmail(String toEmail, String verifyUrl);

    /** Sends a password reset link to a customer/admin. */
    void sendPasswordResetEmail(String toEmail, String resetUrl);

    /** Sends order confirmation with code and total (public code is YYNNNN; rendered as BBYYNNNN). */
    /** Sends order confirmation with GST/tax breakdown. */
    void sendOrderConfirmation(String toEmail, String toName,
                               String publicCodeYYNNNN,
                               String currency,
                               BigDecimal itemsSubtotal,
                               BigDecimal discountTotal,
                               BigDecimal taxableAmount,
                               BigDecimal gstRate,
                               BigDecimal gstAmount,
                               BigDecimal shippingFee,
                               BigDecimal grandTotal);

    /** Sends a notification when order status changes, optionally with note and tracking link. */
    void sendOrderStatusChanged(String toEmail, String toName,
                                String publicCodeYYNNNN, String newStatus, String note, String trackingUrl);

    /** Sends a short request asking the customer to leave a review for the order. */
    void sendReviewRequest(String toEmail, String toName,
                           String publicCodeYYNNNN, String reviewUrl);

    void sendVerificationOtp(String toEmail, String otpCode);

    void sendPasswordResetOtp(String toEmail, String otpCode);
    void sendRichMasked(String toEmail, String subject, String maskedBodyWithMarkers);

    /** Sends a "complete your payment" reminder to a customer who abandoned checkout. */
    void sendPaymentPendingReminder(String toEmail, String toName,
                                    String orderRef, java.math.BigDecimal grandTotal,
                                    String currency, String paymentLink);
}
