package com.blossombuds.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class SmsServiceImpl implements SmsService {

    private static final String FLOW_URL = "https://api.msg91.com/api/v5/flow/";

    // MSG91 Template IDs (sender: BLSMBD)
    private static final String TMPL_SIGNUP_OTP         = "6a393b18b08b3be9c502d012";
    private static final String TMPL_PASSWORD_RESET_OTP = "6a393ad1ef50c235180cbc92";
    private static final String TMPL_LOGIN_OTP          = "6a393a52bff9e83de0098490";
    private static final String TMPL_ORDER_CONFIRMED    = "6a3b868649a307e3f40b4422";
    // TODO: replace with new Vilpower template ID once approved (4-variable template with tracking number)
    private static final String TMPL_ORDER_DISPATCHED   = "6a3b86a8e6c4dacaef0c0194";
    private static final String TMPL_ORDER_DELIVERED    = "6a3b86bfa4e8d7b91c036a84";

    @Value("${msg91.authkey:}")
    private String authKey;

    @Value("${msg91.sender:BLSMBD}")
    private String sender;

    private final RestTemplate restTemplate;

    public SmsServiceImpl() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(10_000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    public void sendSignupOtp(String phone, String otpCode) {
        send(TMPL_SIGNUP_OTP, phone, Map.of("numeric", otpCode));
    }

    @Override
    public void sendPasswordResetOtp(String phone, String otpCode) {
        send(TMPL_PASSWORD_RESET_OTP, phone, Map.of("numeric", otpCode));
    }

    @Override
    public void sendLoginOtp(String phone, String otpCode) {
        send(TMPL_LOGIN_OTP, phone, Map.of("numeric", otpCode));
    }

    @Override
    public void sendOrderConfirmation(String phone, String customerName,
                                      String orderCode, BigDecimal grandTotal, String currency) {
        send(TMPL_ORDER_CONFIRMED, phone, Map.of(
                "name", safe(customerName),
                "ordercode", safe(orderCode),
                "amount", formatAmount(grandTotal, currency)
        ));
    }

    @Override
    public void sendOrderDispatched(String phone, String customerName,
                                    String orderCode, String trackingNumber, String trackingUrl) {
        send(TMPL_ORDER_DISPATCHED, phone, Map.of(
                "name", safe(customerName),
                "ordercode", safe(orderCode),
                "trackingnumber", safe(trackingNumber),
                "url", safe(trackingUrl)
        ));
    }

    @Override
    public void sendOrderDelivered(String phone, String customerName, String orderCode) {
        send(TMPL_ORDER_DELIVERED, phone, Map.of(
                "name", safe(customerName),
                "ordercode", safe(orderCode)
        ));
    }

    private void send(String templateId, String phone, Map<String, String> variables) {
        if (authKey == null || authKey.isBlank()) {
            log.warn("[SMS] authkey not configured — skipping send for templateId={}", templateId);
            return;
        }
        String mobile = normalizePhone(phone);
        if (mobile.isBlank()) {
            log.warn("[SMS] Skipping send — blank phone for templateId={}", templateId);
            return;
        }
        try {
            Map<String, Object> recipient = new LinkedHashMap<>(variables);
            recipient.put("mobiles", mobile);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("flow_id", templateId);
            body.put("sender", sender);
            body.put("recipients", List.of(recipient));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("authkey", authKey);

            restTemplate.postForEntity(FLOW_URL, new HttpEntity<>(body, headers), String.class);

            log.info("[SMS] Sent templateId={} to phone={}", templateId, mask(phone));
        } catch (Exception e) {
            log.error("[SMS] Failed to send templateId={} to phone={}: {}",
                    templateId, mask(phone), e.getMessage(), e);
        }
    }

    private String normalizePhone(String phone) {
        if (phone == null) return "";
        String digits = phone.replaceAll("[^0-9]", "");
        if (digits.length() == 10) return "91" + digits;
        if (digits.length() == 12 && digits.startsWith("91")) return digits;
        if (digits.length() == 13 && digits.startsWith("091")) return digits.substring(1);
        return digits;
    }

    private String formatAmount(BigDecimal amount, String currency) {
        if (amount == null) return "";
        String cur = (currency == null || currency.isBlank()) ? "INR" : currency.trim().toUpperCase();
        return cur + " " + amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String mask(String phone) {
        if (phone == null || phone.length() <= 4) return "****";
        return "****" + phone.substring(phone.length() - 4);
    }
}
