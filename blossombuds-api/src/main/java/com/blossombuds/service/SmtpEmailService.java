package com.blossombuds.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** SMTP implementation using Spring Mail (plain-text messages). */
@Service
@RequiredArgsConstructor
public class SmtpEmailService implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:noreply@example.com}")
    private String from;

    /** Sends an email verification link to a customer. */
    @Override
    public void sendVerificationEmail(String toEmail, String verifyUrl) {
        String subject = "Verify your email";
        String body = """
            Welcome to Blossom & Buds!

            Please verify your email: %s

            Thanks!
            """.formatted(verifyUrl);
        sendPlain(toEmail, subject, body);
    }

    /** Sends a password reset link to a customer/admin. */
    @Override
    public void sendPasswordResetEmail(String toEmail, String resetUrl) {
        String subject = "Reset your password";
        String body = """
            We received a request to reset your password.

            Use this link: %s

            If this wasn't you, you can ignore this email.
            """.formatted(resetUrl);
        sendPlain(toEmail, subject, body);
    }

    /** Sends order confirmation with code and total (public code is YYNNNN; rendered as BBYYNNNN). */
    @Override
    public void sendOrderConfirmation(String toEmail, String toName,
                                      String publicCodeYYNNNN, String currency, BigDecimal grandTotal) {
        String subject = "Your order BB" + publicCodeYYNNNN + " is confirmed";
        String total = formatMoney(grandTotal, currency);
        String body = """
            Hi %s,

            Thanks for your order with Blossom & Buds!
            Order: BB%s
            Total: %s

            We'll notify you when it's dispatched.

            — Blossom & Buds
            """.formatted(safeName(toName), publicCodeYYNNNN, total);
        sendPlain(toEmail, subject, body);
    }

    /** Sends a notification when order status changes, optionally with note and tracking link. */
    @Override
    public void sendOrderStatusChanged(String toEmail, String toName,
                                       String publicCodeYYNNNN, String newStatus, String note, String trackingUrl) {
        String subject = "Order BB" + publicCodeYYNNNN + " → " + newStatus;
        StringBuilder b = new StringBuilder();
        b.append("Hi ").append(safeName(toName)).append(",\n\n")
                .append("Your order BB").append(publicCodeYYNNNN)
                .append(" status is now ").append(newStatus).append(".\n");
        if (note != null && !note.isBlank()) {
            b.append("\nNote: ").append(note).append("\n");
        }
        if (trackingUrl != null && !trackingUrl.isBlank()) {
            b.append("\nTrack your package: ").append(trackingUrl).append("\n");
        }
        b.append("\n— Blossom & Buds\n");
        sendPlain(toEmail, subject, b.toString());
    }

    /** Sends a short request asking the customer to leave a review for the order. */
    @Override
    public void sendReviewRequest(String toEmail, String toName,
                                  String publicCodeYYNNNN, String reviewUrl) {
        String subject = "Review your order BB" + publicCodeYYNNNN;
        String body = """
            Hi %s,

            Hope you loved your order BB%s.
            Could you spare 30 seconds to leave a quick review?

            %s

            Thank you so much!
            — Blossom & Buds
            """.formatted(safeName(toName), publicCodeYYNNNN, reviewUrl);
        sendPlain(toEmail, subject, body);
    }

    /** Sends a plain-text email via Spring Mail with consistent headers. */
    private void sendPlain(String toEmail, String subject, String body) {
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setTo(toEmail);
        msg.setSubject(subject);
        msg.setText(body);
        mailSender.send(msg);
    }

    /** Returns a friendly fallback name when recipient name is blank. */
    private String safeName(String name) {
        return (name == null || name.isBlank()) ? "there" : name.trim();
    }

    /** Formats money as "<CURRENCY> <amount>" with 2 decimals and half-up rounding. */
    private String formatMoney(BigDecimal amount, String currency) {
        String cur = (currency == null || currency.isBlank()) ? "INR" : currency.trim().toUpperCase();
        BigDecimal amt = (amount == null) ? BigDecimal.ZERO : amount.setScale(2, RoundingMode.HALF_UP);
        return cur + " " + amt.toPlainString();
    }
}
