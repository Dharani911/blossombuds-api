package com.blossombuds.service;

import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Stub SMS service — logs all outbound messages without actually sending.
 * Replace with a real provider (MSG91, TextLocal, Twilio, etc.) when ready.
 * Every method here maps 1-to-1 with a DLT-registered template under header BLSMBD.
 */
@Slf4j
public class SmsServiceStub implements SmsService {

    // DLT Template 1 — Signup OTP
    // "Welcome to Blossom Buds Floral Artistry! Your verification code is {#var#}.
    //  Valid for 10 minutes. Do not share this with anyone."
    @Override
    public void sendSignupOtp(String phone, String otpCode) {
        log.info("[SMS][STUB][SIGNUP_OTP] phone={} | OTP intentionally omitted from logs",
                mask(phone));
    }

    // DLT Template 2 — Password Reset OTP
    // "Your Blossom Buds password reset code is {#var#}. Valid for 10 minutes.
    //  Ignore this if you did not request a reset."
    @Override
    public void sendPasswordResetOtp(String phone, String otpCode) {
        log.info("[SMS][STUB][PASSWORD_RESET_OTP] phone={} | OTP intentionally omitted from logs",
                mask(phone));
    }

    // DLT Template 3 — Login OTP  (register this template: "Your Blossom Buds login code is {#var#}. Valid for 10 minutes.")
    @Override
    public void sendLoginOtp(String phone, String otpCode) {
        log.info("[SMS][STUB][LOGIN_OTP] phone={} | OTP intentionally omitted from logs",
                mask(phone));
    }

    // DLT Template 4 — Order Confirmed
    // "Hi {#alphanumeric#}, your Blossom Buds order BB{#alphanumeric#} is confirmed! Total: {#alphanumeric#}.
    //  You will receive another update once it is dispatched."
    @Override
    public void sendOrderConfirmation(String phone, String customerName,
                                      String orderCode, BigDecimal grandTotal, String currency) {
        String amount = formatAmount(grandTotal, currency);
        log.info("[SMS][STUB][ORDER_CONFIRMED] phone={} name={} code=BB{} total={}",
                mask(phone), customerName, orderCode, amount);
    }

    // DLT Template 5 — Order Dispatched
    // "Hi {#alphanumeric#}, your Blossom Buds order BB{#alphanumeric#} has been dispatched!
    //  Track it here: {#url#}"
    @Override
    public void sendOrderDispatched(String phone, String customerName,
                                    String orderCode, String trackingUrl) {
        log.info("[SMS][STUB][ORDER_DISPATCHED] phone={} name={} code=BB{} trackingUrl={}",
                mask(phone), customerName, orderCode, trackingUrl);
    }

    // DLT Template 6 — Order Delivered
    // "Hi {#alphanumeric#}, your Blossom Buds order BB{#alphanumeric#} has been delivered!
    //  We hope you love it. Login to your account to leave a review."
    @Override
    public void sendOrderDelivered(String phone, String customerName, String orderCode) {
        log.info("[SMS][STUB][ORDER_DELIVERED] phone={} name={} code=BB{}",
                mask(phone), customerName, orderCode);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String mask(String phone) {
        if (phone == null || phone.length() <= 4) return "****";
        return "****" + phone.substring(phone.length() - 4);
    }

    private String formatAmount(BigDecimal amount, String currency) {
        if (amount == null) return "";
        String cur = (currency == null || currency.isBlank()) ? "INR" : currency.trim().toUpperCase();
        return cur + " " + amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
