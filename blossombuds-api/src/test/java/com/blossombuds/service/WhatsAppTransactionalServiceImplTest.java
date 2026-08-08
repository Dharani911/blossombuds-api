package com.blossombuds.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WhatsAppTransactionalServiceImplTest {

    @Mock
    private WhatsAppCloudClient cloudClient;

    /** Every send is now recorded in the shared message-event log so delivery statuses can be
     *  attributed back to a template; transactional sends used to leave no trace at all. */
    @Mock
    private com.blossombuds.repository.WhatsAppMessageEventRepository messageEventRepository;

    private WhatsAppTransactionalServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new WhatsAppTransactionalServiceImpl(cloudClient, messageEventRepository);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // sendOrderConfirmation
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * The Meta-approved body is:
     *   "Hi {{1}}, ... *Order:* BB{{2}} ... *Total Paid:* {{3}}"
     *
     * Three variables, and the template supplies the "BB" prefix itself. This previously sent two
     * variables with a "BB"-prefixed code, so every order confirmation was rejected by Meta with
     * error 132000 (parameter count mismatch) and would have rendered "BBBB261234" if it hadn't.
     */
    @Test
    void sendOrderConfirmation_sendsThreeVariables_withBareCodeAndTotal() {
        when(cloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.success("wamid.abc123", false));

        service.sendOrderConfirmation("919876543210", "Priya", "261234",
                new java.math.BigDecimal("1499.5"), "INR");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> varsCaptor = ArgumentCaptor.forClass(List.class);
        verify(cloudClient).sendTemplateMessage(
                eq("919876543210"), eq("order_confirmation"), eq("en"), varsCaptor.capture());

        List<String> vars = varsCaptor.getValue();
        assertThat(vars).hasSize(3);
        assertThat(vars.get(0)).isEqualTo("Priya");
        assertThat(vars.get(1)).isEqualTo("261234");        // bare — template renders the BB prefix
        assertThat(vars.get(2)).isEqualTo("INR 1499.50");   // matches the SMS channel's formatting
    }

    @Test
    void sendOrderConfirmation_defaultsCurrencyToInr_whenBlank() {
        when(cloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.success("wamid.x", false));

        service.sendOrderConfirmation("919876543210", "Priya", "261234",
                new java.math.BigDecimal("200"), "");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> cap = ArgumentCaptor.forClass(List.class);
        verify(cloudClient).sendTemplateMessage(anyString(), anyString(), anyString(), cap.capture());
        assertThat(cap.getValue().get(2)).isEqualTo("INR 200.00");
    }

    @Test
    void sendOrderConfirmation_skips_whenPhoneBlank() {
        service.sendOrderConfirmation("", "Priya", "261234", java.math.BigDecimal.TEN, "INR");
        verifyNoInteractions(cloudClient);
    }

    @Test
    void sendOrderConfirmation_skips_whenPhoneNull() {
        service.sendOrderConfirmation(null, "Priya", "261234", java.math.BigDecimal.TEN, "INR");
        verifyNoInteractions(cloudClient);
    }

    @Test
    void sendOrderConfirmation_fallsBackToCustomer_whenNameNull() {
        when(cloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.success("wamid.x", false));

        service.sendOrderConfirmation("919876543210", null, "261234", java.math.BigDecimal.TEN, "INR");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> cap = ArgumentCaptor.forClass(List.class);
        verify(cloudClient).sendTemplateMessage(anyString(), anyString(), anyString(), cap.capture());
        assertThat(cap.getValue().get(0)).isEqualTo("Customer");
    }

    @Test
    void sendOrderConfirmation_doesNotPropagate_whenCloudClientFails() {
        when(cloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.failed("Meta API error"));

        // must not throw
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() ->
                service.sendOrderConfirmation("919876543210", "Priya", "261234", java.math.BigDecimal.TEN, "INR"));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // sendOrderDispatched
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void sendOrderDispatched_callsCorrectTemplate_withFourVariables() {
        when(cloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.success("wamid.def", false));

        service.sendOrderDispatched("919876543210", "Ravi", "261234",
                "TN123456789IN", "https://track.example.com/TN123456789IN");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> cap = ArgumentCaptor.forClass(List.class);
        verify(cloudClient).sendTemplateMessage(
                eq("919876543210"), eq("order_dispatched"), eq("en"), cap.capture());

        List<String> vars = cap.getValue();
        assertThat(vars).hasSize(4);
        assertThat(vars.get(0)).isEqualTo("Ravi");
        assertThat(vars.get(1)).isEqualTo("BB261234");
        assertThat(vars.get(2)).isEqualTo("TN123456789IN");
        assertThat(vars.get(3)).isEqualTo("https://track.example.com/TN123456789IN");
    }

    @Test
    void sendOrderDispatched_skips_whenPhoneBlank() {
        service.sendOrderDispatched("", "Ravi", "261234", "TN123", "https://t.com");
        verifyNoInteractions(cloudClient);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // sendOrderDelivered
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void sendOrderDelivered_callsCorrectTemplate_withThreeVariables() {
        when(cloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.success("wamid.ghi", false));

        service.sendOrderDelivered("919876543210", "Meena", "261234", "https://review.example.com");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> cap = ArgumentCaptor.forClass(List.class);
        verify(cloudClient).sendTemplateMessage(
                eq("919876543210"), eq("order_delivered"), eq("en"), cap.capture());

        List<String> vars = cap.getValue();
        assertThat(vars).hasSize(3);
        assertThat(vars.get(0)).isEqualTo("Meena");
        assertThat(vars.get(1)).isEqualTo("BB261234");
        assertThat(vars.get(2)).isEqualTo("https://review.example.com");
    }

    @Test
    void sendOrderDelivered_skips_whenPhoneNull() {
        service.sendOrderDelivered(null, "Meena", "261234", "https://r.com");
        verifyNoInteractions(cloudClient);
    }
}
