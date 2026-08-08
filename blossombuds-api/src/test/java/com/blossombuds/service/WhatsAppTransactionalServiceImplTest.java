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

    private WhatsAppTransactionalServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new WhatsAppTransactionalServiceImpl(cloudClient);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // sendOrderConfirmation
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void sendOrderConfirmation_callsCorrectTemplate_withNameAndBBPrefixedCode() {
        when(cloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.success("wamid.abc123", false));

        service.sendOrderConfirmation("919876543210", "Priya", "261234");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> varsCaptor = ArgumentCaptor.forClass(List.class);
        verify(cloudClient).sendTemplateMessage(
                eq("919876543210"), eq("order_confirmation"), eq("en"), varsCaptor.capture());

        List<String> vars = varsCaptor.getValue();
        assertThat(vars).hasSize(2);
        assertThat(vars.get(0)).isEqualTo("Priya");
        assertThat(vars.get(1)).isEqualTo("BB261234");   // must have BB prefix
    }

    @Test
    void sendOrderConfirmation_skips_whenPhoneBlank() {
        service.sendOrderConfirmation("", "Priya", "261234");
        verifyNoInteractions(cloudClient);
    }

    @Test
    void sendOrderConfirmation_skips_whenPhoneNull() {
        service.sendOrderConfirmation(null, "Priya", "261234");
        verifyNoInteractions(cloudClient);
    }

    @Test
    void sendOrderConfirmation_fallsBackToCustomer_whenNameNull() {
        when(cloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.success("wamid.x", false));

        service.sendOrderConfirmation("919876543210", null, "261234");

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
                service.sendOrderConfirmation("919876543210", "Priya", "261234"));
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
