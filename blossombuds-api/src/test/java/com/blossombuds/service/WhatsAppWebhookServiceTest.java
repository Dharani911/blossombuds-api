package com.blossombuds.service;

import com.blossombuds.domain.*;
import com.blossombuds.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WhatsAppWebhookServiceTest {

    @Mock private WhatsAppMessageEventRepository messageEventRepository;
    @Mock private WhatsAppCampaignRecipientRepository recipientRepository;
    @Mock private WhatsAppCampaignRepository campaignRepository;
    @Mock private WhatsAppCloudClient whatsAppCloudClient;
    @Mock private SettingsService settingsService;
    @Mock private CustomerWhatsAppPreferenceRepository preferenceRepository;
    @Mock private WhatsAppContactRepository whatsAppContactRepository;

    private WhatsAppWebhookService service;

    @BeforeEach
    void setUp() {
        service = new WhatsAppWebhookService(
                new ObjectMapper(), messageEventRepository, recipientRepository,
                campaignRepository, whatsAppCloudClient, settingsService,
                preferenceRepository, whatsAppContactRepository);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // processWebhookPayload — null / blank payload
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void processWebhookPayload_doesNothing_whenPayloadNull() {
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(
                () -> service.processWebhookPayload(null));
        verifyNoInteractions(recipientRepository, campaignRepository);
    }

    @Test
    void processWebhookPayload_doesNothing_whenPayloadBlank() {
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(
                () -> service.processWebhookPayload("   "));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STOP message — opts out preference and contact
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void processWebhookPayload_handlesStop_andOptsOutPreference() {
        String payload = stopPayload("919876543210", "STOP");
        when(messageEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CustomerWhatsAppPreference pref = pref(1L, "+919876543210");
        // The E.164 form matches first, so handleStop's .or() fallback to the plain-digits form is
        // never reached — stubbing it would be flagged as an unnecessary stubbing. Likewise
        // brand.whatsapp: a STOP message routes to handleStop and never to the auto-reply.
        when(preferenceRepository.findByPhoneAndActiveTrue("+919876543210"))
                .thenReturn(Optional.of(pref));
        when(whatsAppContactRepository.findByPhone(anyString())).thenReturn(Optional.empty());

        service.processWebhookPayload(payload);

        ArgumentCaptor<CustomerWhatsAppPreference> cap =
                ArgumentCaptor.forClass(CustomerWhatsAppPreference.class);
        verify(preferenceRepository).save(cap.capture());

        CustomerWhatsAppPreference saved = cap.getValue();
        assertThat(saved.getOptedIn()).isFalse();
        assertThat(saved.getActive()).isFalse();
        assertThat(saved.getOptedOutAt()).isNotNull();
    }

    @Test
    void processWebhookPayload_handlesStop_andOptsOutContact() {
        String payload = stopPayload("919876543210", "STOP");
        when(messageEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(preferenceRepository.findByPhoneAndActiveTrue(anyString())).thenReturn(Optional.empty());

        // As above: the E.164 lookup matches, so the plain-digits fallback and the auto-reply
        // settings read are both unreachable on the STOP path.
        WhatsAppContact contact = contact("+919876543210");
        when(whatsAppContactRepository.findByPhone("+919876543210")).thenReturn(Optional.of(contact));

        service.processWebhookPayload(payload);

        ArgumentCaptor<WhatsAppContact> cap = ArgumentCaptor.forClass(WhatsAppContact.class);
        verify(whatsAppContactRepository).save(cap.capture());
        assertThat(cap.getValue().getOptedIn()).isFalse();
        assertThat(cap.getValue().getActive()).isFalse();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Status webhook — delivered, read, failed update recipient rows
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void processWebhookPayload_updatesRecipientStatus_toDelivered() {
        String payload = statusPayload("wamid.123", "delivered", "919999999999");
        when(messageEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WhatsAppCampaignRecipient r = recipient(1L, "wamid.123");
        when(recipientRepository.findByProviderMessageId("wamid.123")).thenReturn(Optional.of(r));
        when(recipientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(campaignRepository.findByIdAndActiveTrue(anyLong())).thenReturn(Optional.empty());

        service.processWebhookPayload(payload);

        ArgumentCaptor<WhatsAppCampaignRecipient> cap =
                ArgumentCaptor.forClass(WhatsAppCampaignRecipient.class);
        verify(recipientRepository).save(cap.capture());
        assertThat(cap.getValue().getStatus()).isEqualTo("DELIVERED");
        assertThat(cap.getValue().getDeliveredAt()).isNotNull();
    }

    @Test
    void processWebhookPayload_updatesRecipientStatus_toRead() {
        String payload = statusPayload("wamid.456", "read", "919999999999");
        when(messageEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WhatsAppCampaignRecipient r = recipient(2L, "wamid.456");
        when(recipientRepository.findByProviderMessageId("wamid.456")).thenReturn(Optional.of(r));
        when(recipientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(campaignRepository.findByIdAndActiveTrue(anyLong())).thenReturn(Optional.empty());

        service.processWebhookPayload(payload);

        ArgumentCaptor<WhatsAppCampaignRecipient> cap =
                ArgumentCaptor.forClass(WhatsAppCampaignRecipient.class);
        verify(recipientRepository).save(cap.capture());
        assertThat(cap.getValue().getStatus()).isEqualTo("READ");
    }

    @Test
    void processWebhookPayload_updatesRecipientStatus_toFailed_withErrorMessage() {
        String payload = statusPayloadWithError("wamid.789", "failed", "919999999999",
                "131026", "Message undeliverable");
        when(messageEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WhatsAppCampaignRecipient r = recipient(3L, "wamid.789");
        when(recipientRepository.findByProviderMessageId("wamid.789")).thenReturn(Optional.of(r));
        when(recipientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(campaignRepository.findByIdAndActiveTrue(anyLong())).thenReturn(Optional.empty());

        service.processWebhookPayload(payload);

        ArgumentCaptor<WhatsAppCampaignRecipient> cap =
                ArgumentCaptor.forClass(WhatsAppCampaignRecipient.class);
        verify(recipientRepository).save(cap.capture());
        assertThat(cap.getValue().getStatus()).isEqualTo("FAILED");
        assertThat(cap.getValue().getErrorMessage()).isEqualTo("Message undeliverable");
    }

    @Test
    void processWebhookPayload_doesNotThrow_onMalformedJson() {
        when(messageEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(
                () -> service.processWebhookPayload("{not valid json{{"));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Payload builders
    // ──────────────────────────────────────────────────────────────────────────

    private String stopPayload(String fromPhone, String bodyText) {
        return """
            {"entry":[{"changes":[{"value":{"messages":[{
                "id":"wamid.stop1",
                "from":"%s",
                "type":"text",
                "text":{"body":"%s"}
            }]}}]}]}
            """.formatted(fromPhone, bodyText);
    }

    private String statusPayload(String wamid, String status, String recipientId) {
        return """
            {"entry":[{"changes":[{"value":{"statuses":[{
                "id":"%s",
                "status":"%s",
                "recipient_id":"%s"
            }]}}]}]}
            """.formatted(wamid, status, recipientId);
    }

    private String statusPayloadWithError(String wamid, String status, String recipientId,
                                          String errorCode, String errorMessage) {
        return """
            {"entry":[{"changes":[{"value":{"statuses":[{
                "id":"%s",
                "status":"%s",
                "recipient_id":"%s",
                "errors":[{"code":"%s","message":"%s"}]
            }]}}]}]}
            """.formatted(wamid, status, recipientId, errorCode, errorMessage);
    }

    private CustomerWhatsAppPreference pref(Long customerId, String phone) {
        CustomerWhatsAppPreference p = new CustomerWhatsAppPreference();
        p.setId(1L);
        p.setCustomerId(customerId);
        p.setPhone(phone);
        p.setOptedIn(true);
        p.setActive(true);
        return p;
    }

    private WhatsAppContact contact(String phone) {
        WhatsAppContact c = new WhatsAppContact();
        c.setId(1L);
        c.setPhone(phone);
        c.setOptedIn(true);
        c.setActive(true);
        return c;
    }

    private WhatsAppCampaignRecipient recipient(Long id, String providerMessageId) {
        WhatsAppCampaignRecipient r = new WhatsAppCampaignRecipient();
        r.setId(id);
        r.setCampaignId(1L);
        r.setProviderMessageId(providerMessageId);
        r.setStatus("SENT");
        return r;
    }
}
