// com/blossombuds/service/payments/RazorpayApiClient.java
package com.blossombuds.service.payments;

import com.blossombuds.security.RazorPayProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/** Minimal HTTP client to call Razorpay REST API using RestTemplate. */
@Component
@RequiredArgsConstructor
public class RazorpayApiClient {

    private final RazorPayProperties props;
    private final RestTemplate rest;

    /** Creates a Razorpay order (amount in paise). */
    public Map<String, Object> createOrder(long amountPaise, String currency, String receipt,
                                           Map<String, String> notes, boolean paymentCapture) {
        String url = props.getBaseUrl() + "/orders";

        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.set("Authorization", basicAuth(props.getKeyId(), props.getKeySecret()));

        Map<String, Object> body = Map.of(
                "amount", amountPaise,
                "currency", currency,
                "receipt", receipt,
                "payment_capture", paymentCapture ? 1 : 0,
                "notes", notes == null ? Map.of() : notes
        );

        ResponseEntity<Map> resp = rest.exchange(url, HttpMethod.POST, new HttpEntity<>(body, h), Map.class);
        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            throw new IllegalStateException("Failed to create Razorpay order");
        }
        return resp.getBody();
    }

    private String basicAuth(String keyId, String keySecret) {
        String raw = keyId + ":" + keySecret;
        return "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }
}
