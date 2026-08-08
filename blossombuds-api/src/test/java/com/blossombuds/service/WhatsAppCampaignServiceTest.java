package com.blossombuds.service;

import com.blossombuds.domain.*;
import com.blossombuds.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WhatsAppCampaignServiceTest {

    @Mock private WhatsAppTemplateRepository templateRepository;
    @Mock private WhatsAppCampaignRepository campaignRepository;
    @Mock private WhatsAppCampaignRecipientRepository recipientRepository;
    @Mock private CustomerWhatsAppPreferenceRepository preferenceRepository;
    @Mock private WhatsAppContactRepository whatsAppContactRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private WhatsAppCloudClient whatsAppCloudClient;
    @Mock private EmailCampaignService emailCampaignService;

    private WhatsAppCampaignService service;

    @BeforeEach
    void setUp() {
        service = new WhatsAppCampaignService(
                templateRepository, campaignRepository, recipientRepository,
                preferenceRepository, whatsAppContactRepository,
                customerRepository, whatsAppCloudClient, emailCampaignService);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // createCampaign — validation
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void createCampaign_throwsOnNullRequest() {
        assertThatThrownBy(() -> service.createCampaign(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createCampaign_throwsOnBlankTitle() {
        var req = campaignRequest("  ", 1L, "ALL_OPTED_IN");
        assertThatThrownBy(() -> service.createCampaign(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("title");
    }

    @Test
    void createCampaign_throwsOnMissingTemplateId() {
        var req = new WhatsAppCampaignService.CreateCampaignRequest();
        req.setTitle("Test");
        assertThatThrownBy(() -> service.createCampaign(req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // createCampaign — name resolution (ALL_OPTED_IN must use real customer names)
    // Regression: before the fix, every recipient got name "Customer"
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void createCampaign_allOptedIn_usesRealCustomerNames_notHardcodedCustomer() {
        WhatsAppTemplate template = template(1L, "festival_offers");
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(template));

        CustomerWhatsAppPreference pref1 = pref(10L, "+919876543210");
        CustomerWhatsAppPreference pref2 = pref(20L, "+919123456789");
        when(preferenceRepository.findByOptedInTrueAndActiveTrue()).thenReturn(List.of(pref1, pref2));

        Customer c1 = customer(10L, "Priya",  "+919876543210");
        Customer c2 = customer(20L, "Ravi",   "+919123456789");
        when(customerRepository.findAllById(Set.of(10L, 20L))).thenReturn(List.of(c1, c2));

        WhatsAppCampaign saved = campaign(5L, "festival_offers", "ALL_OPTED_IN");
        when(campaignRepository.save(any())).thenReturn(saved);

        service.createCampaign(campaignRequest("Festive offer", 1L, "ALL_OPTED_IN"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<WhatsAppCampaignRecipient>> cap = ArgumentCaptor.forClass(List.class);
        verify(recipientRepository).saveAll(cap.capture());

        List<WhatsAppCampaignRecipient> recipients = cap.getValue();
        assertThat(recipients).hasSize(2);
        assertThat(recipients).extracting("recipientName")
                .containsExactlyInAnyOrder("Priya", "Ravi");
        // Must NOT contain the hardcoded fallback for any recipient that has a real name
        assertThat(recipients).extracting("recipientName")
                .doesNotContain("Customer");
    }

    @Test
    void createCampaign_allOptedIn_fallsBackToCustomer_whenCustomerHasNoName() {
        WhatsAppTemplate template = template(1L, "festival_offers");
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(template));

        CustomerWhatsAppPreference pref = pref(10L, "+91999");
        when(preferenceRepository.findByOptedInTrueAndActiveTrue()).thenReturn(List.of(pref));

        Customer c = customer(10L, null, "+91999");   // no name
        when(customerRepository.findAllById(Set.of(10L))).thenReturn(List.of(c));

        WhatsAppCampaign saved = campaign(5L, "festival_offers", "ALL_OPTED_IN");
        when(campaignRepository.save(any())).thenReturn(saved);

        service.createCampaign(campaignRequest("Test", 1L, "ALL_OPTED_IN"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<WhatsAppCampaignRecipient>> cap = ArgumentCaptor.forClass(List.class);
        verify(recipientRepository).saveAll(cap.capture());

        assertThat(cap.getValue().get(0).getRecipientName()).isEqualTo("Customer");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // createCampaign — MANUAL audience uses supplied names
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void createCampaign_manual_usesSuppliedNamesAndPhones() {
        WhatsAppTemplate template = template(1L, "festival_offers");
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(template));

        var req = campaignRequest("Test", 1L, "MANUAL");
        req.setRecipients(List.of(manualRecipient("Deepa", "+919000000001"),
                                  manualRecipient("Suresh", "+919000000002")));
        WhatsAppCampaign saved = campaign(6L, "festival_offers", "MANUAL");
        when(campaignRepository.save(any())).thenReturn(saved);

        service.createCampaign(req);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<WhatsAppCampaignRecipient>> cap = ArgumentCaptor.forClass(List.class);
        verify(recipientRepository).saveAll(cap.capture());

        assertThat(cap.getValue()).extracting("recipientName")
                .containsExactlyInAnyOrder("Deepa", "Suresh");
    }

    @Test
    void createCampaign_manual_throwsWhenRecipientsEmpty() {
        WhatsAppTemplate template = template(1L, "festival_offers");
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(template));

        var req = campaignRequest("Test", 1L, "MANUAL");
        req.setRecipients(List.of());   // empty
        when(campaignRepository.save(any())).thenReturn(campaign(1L, "festival_offers", "MANUAL"));

        assertThatThrownBy(() -> service.createCampaign(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("recipient");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // createCampaign — audience-template compatibility rules
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void createCampaign_rejects_expoTemplate_sentToAllOptedIn() {
        WhatsAppTemplate template = template(1L, "expo_outreach");
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(template));

        assertThatThrownBy(() -> service.createCampaign(campaignRequest("T", 1L, "ALL_OPTED_IN")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("expo_outreach");
    }

    @Test
    void createCampaign_rejects_marketingTemplate_sentToExpoContacts() {
        WhatsAppTemplate template = template(1L, "festival_offers");
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(template));

        assertThatThrownBy(() -> service.createCampaign(campaignRequest("T", 1L, "EXPO_CONTACTS")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createCampaign_rejects_alsoEmailPhoneless_forNonAllOptedIn() {
        WhatsAppTemplate template = template(1L, "expo_outreach");
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(template));

        var req = campaignRequest("T", 1L, "EXPO_CONTACTS");
        req.setAlsoEmailPhoneless(true);

        assertThatThrownBy(() -> service.createCampaign(req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // createCampaign — EXPO_CONTACTS skips registered customers
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void createCampaign_expoContacts_skipsRegisteredCustomerPhones() {
        WhatsAppTemplate template = template(1L, "expo_outreach");
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(template));

        // One registered phone, one expo-only phone
        when(customerRepository.findAllRegisteredPhones()).thenReturn(Set.of("+919876543210"));

        WhatsAppContact registered = expoContact(1L, "+919876543210", "Already customer");
        WhatsAppContact fresh      = expoContact(2L, "+919000000000", "New Lead");
        when(whatsAppContactRepository.findByOptedInTrueAndActiveTrue())
                .thenReturn(List.of(registered, fresh));

        WhatsAppCampaign saved = campaign(7L, "expo_outreach", "EXPO_CONTACTS");
        when(campaignRepository.save(any())).thenReturn(saved);

        service.createCampaign(campaignRequest("Expo", 1L, "EXPO_CONTACTS"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<WhatsAppCampaignRecipient>> cap = ArgumentCaptor.forClass(List.class);
        verify(recipientRepository).saveAll(cap.capture());

        assertThat(cap.getValue()).hasSize(1);
        assertThat(cap.getValue().get(0).getRecipientName()).isEqualTo("New Lead");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // sendCampaign — status outcomes
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void sendCampaign_marksCompleted_whenAllSucceed() {
        WhatsAppCampaign c = campaign(10L, "festival_offers", "ALL_OPTED_IN");
        WhatsAppTemplate t = template(1L, "festival_offers");
        c.setTemplateId(1L);
        when(campaignRepository.findByIdAndActiveTrue(10L)).thenReturn(Optional.of(c));
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(t));

        WhatsAppCampaignRecipient r = recipient(1L, 10L, "919876543210", "Priya",
                "name=Priya;link=;orderCode=;trackingNumber=;trackingLink=;paymentLink=;offerText=20% off;imageUrl=");
        when(recipientRepository.findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(10L, "PENDING"))
                .thenReturn(List.of(r));
        when(recipientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(whatsAppCloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.success("wamid.ok", false));
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // linked email: campaign has alsoEmailPhoneless=false, so no email call needed
        WhatsAppCampaign result = service.sendCampaign(10L);
        assertThat(result.getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    void sendCampaign_marksFailed_whenAllFail() {
        WhatsAppCampaign c = campaign(11L, "festival_offers", "ALL_OPTED_IN");
        WhatsAppTemplate t = template(1L, "festival_offers");
        c.setTemplateId(1L);
        when(campaignRepository.findByIdAndActiveTrue(11L)).thenReturn(Optional.of(c));
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(t));

        WhatsAppCampaignRecipient r = recipient(1L, 11L, "919111111111", "Test",
                "name=Test;link=;orderCode=;trackingNumber=;trackingLink=;paymentLink=;offerText=;imageUrl=");
        when(recipientRepository.findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(11L, "PENDING"))
                .thenReturn(List.of(r));
        when(recipientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(whatsAppCloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.failed("Meta error"));
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WhatsAppCampaign result = service.sendCampaign(11L);
        assertThat(result.getStatus()).isEqualTo("FAILED");
    }

    @Test
    void sendCampaign_throwsOnUnknownCampaignId() {
        when(campaignRepository.findByIdAndActiveTrue(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.sendCampaign(99L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // sendCampaign — linked email campaign is created when alsoEmailPhoneless=true
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void sendCampaign_triggersLinkedEmailCampaign_whenFlagSet() {
        WhatsAppCampaign c = campaign(12L, "festival_offers", "ALL_OPTED_IN");
        c.setAlsoEmailPhoneless(true);
        WhatsAppTemplate t = template(1L, "festival_offers");
        c.setTemplateId(1L);
        when(campaignRepository.findByIdAndActiveTrue(12L)).thenReturn(Optional.of(c));
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(t));

        WhatsAppCampaignRecipient r = recipient(1L, 12L, "919876543210", "Priya",
                "name=Priya;link=https://shop.com;orderCode=;trackingNumber=;trackingLink=;paymentLink=;offerText=Save 20%;imageUrl=");
        when(recipientRepository.findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(12L, "PENDING"))
                .thenReturn(List.of(r));
        when(recipientRepository.findByCampaignIdAndActiveTrueOrderByCreatedAtAsc(12L))
                .thenReturn(List.of(r));
        when(recipientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(whatsAppCloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.success("wamid.ok", false));

        EmailCampaign emailCampaign = new EmailCampaign();
        emailCampaign.setId(99L);
        emailCampaign.setTotalRecipients(3);
        emailCampaign.setStatus("COMPLETED");
        emailCampaign.setSentCount(3);
        emailCampaign.setFailedCount(0);
        when(emailCampaignService.createCampaign(any())).thenReturn(emailCampaign);
        when(emailCampaignService.sendCampaign(99L)).thenReturn(emailCampaign);
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WhatsAppCampaign result = service.sendCampaign(12L);

        verify(emailCampaignService).createCampaign(any());
        verify(emailCampaignService).sendCampaign(99L);
        assertThat(result.getLinkedEmailCampaignId()).isEqualTo(99L);
    }

    @Test
    void sendCampaign_doesNotTriggerLinkedEmail_whenFlagFalse() {
        WhatsAppCampaign c = campaign(13L, "festival_offers", "ALL_OPTED_IN");
        c.setAlsoEmailPhoneless(false);
        WhatsAppTemplate t = template(1L, "festival_offers");
        c.setTemplateId(1L);
        when(campaignRepository.findByIdAndActiveTrue(13L)).thenReturn(Optional.of(c));
        when(templateRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(t));

        WhatsAppCampaignRecipient r = recipient(1L, 13L, "919876543210", "Priya",
                "name=Priya;link=;orderCode=;trackingNumber=;trackingLink=;paymentLink=;offerText=;imageUrl=");
        when(recipientRepository.findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(13L, "PENDING"))
                .thenReturn(List.of(r));
        when(recipientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(whatsAppCloudClient.sendTemplateMessage(anyString(), anyString(), anyString(), anyList()))
                .thenReturn(WhatsAppCloudClient.SendResult.success("wamid.ok", false));
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.sendCampaign(13L);
        verifyNoInteractions(emailCampaignService);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private WhatsAppCampaignService.CreateCampaignRequest campaignRequest(
            String title, Long templateId, String audienceType) {
        var r = new WhatsAppCampaignService.CreateCampaignRequest();
        r.setTitle(title);
        r.setTemplateId(templateId);
        r.setAudienceType(audienceType);
        r.setOfferText("20% off");
        return r;
    }

    private WhatsAppTemplate template(Long id, String providerName) {
        WhatsAppTemplate t = new WhatsAppTemplate();
        t.setId(id);
        t.setName(providerName);
        t.setProviderTemplateName(providerName);
        t.setCategory("MARKETING");
        t.setLanguageCode("en");
        t.setActive(true);
        return t;
    }

    private WhatsAppCampaign campaign(Long id, String templateName, String audienceType) {
        WhatsAppCampaign c = new WhatsAppCampaign();
        c.setId(id);
        c.setTitle("Test campaign");
        c.setTemplateId(1L);
        c.setAudienceType(audienceType);
        c.setStatus("DRAFT");
        c.setSentCount(0);
        c.setFailedCount(0);
        c.setAlsoEmailPhoneless(false);
        return c;
    }

    private CustomerWhatsAppPreference pref(Long customerId, String phone) {
        CustomerWhatsAppPreference p = new CustomerWhatsAppPreference();
        p.setCustomerId(customerId);
        p.setPhone(phone);
        p.setOptedIn(true);
        p.setActive(true);
        return p;
    }

    private Customer customer(Long id, String name, String phone) {
        Customer c = new Customer();
        c.setId(id);
        c.setName(name);
        c.setPhone(phone);
        c.setActive(true);
        return c;
    }

    private WhatsAppContact expoContact(Long id, String phone, String name) {
        WhatsAppContact c = new WhatsAppContact();
        c.setId(id);
        c.setPhone(phone);
        c.setName(name);
        c.setOptedIn(true);
        c.setActive(true);
        return c;
    }

    private WhatsAppCampaignRecipient recipient(Long id, Long campaignId,
                                                String phone, String name, String variablesJson) {
        WhatsAppCampaignRecipient r = new WhatsAppCampaignRecipient();
        r.setId(id);
        r.setCampaignId(campaignId);
        r.setPhone(phone);
        r.setRecipientName(name);
        r.setStatus("PENDING");
        r.setVariablesJson(variablesJson);
        return r;
    }

    private WhatsAppCampaignService.ManualRecipient manualRecipient(String name, String phone) {
        var mr = new WhatsAppCampaignService.ManualRecipient();
        mr.setName(name);
        mr.setPhone(phone);
        return mr;
    }
}
