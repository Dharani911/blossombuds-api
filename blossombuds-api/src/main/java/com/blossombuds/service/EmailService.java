package com.blossombuds.service;

import java.math.BigDecimal;

/** Abstraction for all outgoing emails. */
public interface EmailService {

    /** Sends an email verification link to a customer. */
    void sendVerificationEmail(String toEmail, String verifyUrl);

    /** Sends a password reset link to a customer/admin. */
    void sendPasswordResetEmail(String toEmail, String resetUrl);

    /** Sends order confirmation with code and total (public code is YYNNNN; rendered as BBYYNNNN). */
    void sendOrderConfirmation(String toEmail, String toName,
                               String publicCodeYYNNNN, String currency, BigDecimal grandTotal);

    /** Sends a notification when order status changes, optionally with note and tracking link. */
    void sendOrderStatusChanged(String toEmail, String toName,
                                String publicCodeYYNNNN, String newStatus, String note, String trackingUrl);

    /** Sends a short request asking the customer to leave a review for the order. */
    void sendReviewRequest(String toEmail, String toName,
                           String publicCodeYYNNNN, String reviewUrl);
}
