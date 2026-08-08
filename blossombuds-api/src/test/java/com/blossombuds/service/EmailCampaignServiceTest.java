package com.blossombuds.service;

import com.blossombuds.domain.*;
import com.blossombuds.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailCampaignServiceTest {

    @Mock private EmailCampaignRepository campaignRepository;
    @Mock private EmailCampaignRecipientRepository recipientRepository;
    @Mock private CustomerEmailPreferenceRepository preferenceRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private EmailService emailService;

    private EmailCampaignService service;

    @BeforeEach
    void setUp() {
        service = new EmailCampaignService(
                campaignRepository, recipientRepository,
                preferenceRepository, customerRepository, emailService);
        ReflectionTestUtils.setField(service, "unsubscribeBaseUrl", "https://api.blossombuds.com");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // countAudience — distinct reach, not cumulative sends
    // ──────────────────────────────────────────────────────────────────────────

    private Customer customer(long id) {
        Customer c = new Customer();
        c.setId(id);
        c.setEmail("c" + id + "@example.com");
        return c;
    }

    private CustomerEmailPreference unsub(long customerId) {
        CustomerEmailPreference p = new CustomerEmailPreference();
        p.setCustomerId(customerId);
        p.setUnsubscribed(true);
        return p;
    }

    @Test
    void countAudience_isEligibleMinusUnsubscribed() {
        when(customerRepository.findMarketingEmailEligible())
                .thenReturn(List.of(customer(1), customer(2), customer(3)));
        when(preferenceRepository.findByUnsubscribedTrue())
                .thenReturn(List.of(unsub(2))); // customer 2 opted out

        assertThat(service.countAudience()).isEqualTo(2L);
    }

    @Test
    void countAudience_isZeroWhenNoneEligible() {
        when(customerRepository.findMarketingEmailEligible()).thenReturn(List.of());
        when(preferenceRepository.findByUnsubscribedTrue()).thenReturn(List.of());

        assertThat(service.countAudience()).isEqualTo(0L);
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
        var req = new EmailCampaignService.CreateCampaignRequest();
        req.setTitle("  ");
        req.setSubject("Sub");
        req.setBodyText("Body");
        assertThatThrownBy(() -> service.createCampaign(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("title");
    }

    @Test
    void createCampaign_throwsOnBlankSubject() {
        var req = new EmailCampaignService.CreateCampaignRequest();
        req.setTitle("Title");
        req.setSubject("");
        req.setBodyText("Body");
        assertThatThrownBy(() -> service.createCampaign(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("subject");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // createCampaign — audience: unsubscribed customers are excluded
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void createCampaign_excludesUnsubscribedCustomers() {
        Customer c1 = customer(1L, "Priya", "priya@example.com");
        Customer c2 = customer(2L, "Ravi",  "ravi@example.com");  // unsubscribed
        when(customerRepository.findMarketingEmailEligible()).thenReturn(List.of(c1, c2));

        CustomerEmailPreference unsub = new CustomerEmailPreference();
        unsub.setCustomerId(2L);
        unsub.setUnsubscribed(true);
        when(preferenceRepository.findByUnsubscribedTrue()).thenReturn(List.of(unsub));

        EmailCampaign saved = savedCampaign(10L);
        when(campaignRepository.save(any())).thenReturn(saved);

        var req = new EmailCampaignService.CreateCampaignRequest();
        req.setTitle("Title");
        req.setSubject("Sub");
        req.setBodyText("Body");
        service.createCampaign(req);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<EmailCampaignRecipient>> cap = ArgumentCaptor.forClass(List.class);
        verify(recipientRepository).saveAll(cap.capture());

        List<EmailCampaignRecipient> recipients = cap.getValue();
        assertThat(recipients).hasSize(1);
        assertThat(recipients.get(0).getEmail()).isEqualTo("priya@example.com");
    }

    @Test
    void createCampaign_includesAllEligibleWhenNoneUnsubscribed() {
        when(customerRepository.findMarketingEmailEligible())
                .thenReturn(List.of(
                        customer(1L, "A", "a@x.com"),
                        customer(2L, "B", "b@x.com")));
        when(preferenceRepository.findByUnsubscribedTrue()).thenReturn(List.of());
        EmailCampaign saved = savedCampaign(10L);
        when(campaignRepository.save(any())).thenReturn(saved);

        var req = new EmailCampaignService.CreateCampaignRequest();
        req.setTitle("T"); req.setSubject("S"); req.setBodyText("B");
        service.createCampaign(req);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<EmailCampaignRecipient>> cap = ArgumentCaptor.forClass(List.class);
        verify(recipientRepository).saveAll(cap.capture());
        assertThat(cap.getValue()).hasSize(2);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // sendCampaign — status outcomes
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void sendCampaign_marksCompleted_whenAllSucceed() {
        EmailCampaign campaign = savedCampaign(5L);
        when(campaignRepository.findByIdAndActiveTrue(5L)).thenReturn(Optional.of(campaign));

        EmailCampaignRecipient r = recipient(1L, 5L, "a@b.com");
        when(recipientRepository.findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(5L, "PENDING"))
                .thenReturn(List.of(r));
        when(recipientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(preferenceRepository.findByCustomerId(anyLong())).thenReturn(Optional.empty());
        when(preferenceRepository.save(any())).thenAnswer(inv -> {
            CustomerEmailPreference p = inv.getArgument(0);
            if (p.getUnsubscribeToken() == null) p.setUnsubscribeToken("test-token");
            return p;
        });
        when(emailService.sendMarketingEmailSync(anyString(), anyString(), anyString()))
                .thenReturn(EmailService.EmailSendResult.ok());
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        EmailCampaign result = service.sendCampaign(5L);
        assertThat(result.getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    void sendCampaign_marksPartial_whenSomeFail() {
        EmailCampaign campaign = savedCampaign(6L);
        when(campaignRepository.findByIdAndActiveTrue(6L)).thenReturn(Optional.of(campaign));

        EmailCampaignRecipient r1 = recipient(1L, 6L, "ok@b.com");
        EmailCampaignRecipient r2 = recipient(2L, 6L, "fail@b.com");
        when(recipientRepository.findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(6L, "PENDING"))
                .thenReturn(List.of(r1, r2));
        when(recipientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(preferenceRepository.findByCustomerId(anyLong())).thenReturn(Optional.empty());
        when(preferenceRepository.save(any())).thenAnswer(inv -> {
            CustomerEmailPreference p = inv.getArgument(0);
            if (p.getUnsubscribeToken() == null) p.setUnsubscribeToken("tok");
            return p;
        });
        when(emailService.sendMarketingEmailSync(eq("ok@b.com"), anyString(), anyString()))
                .thenReturn(EmailService.EmailSendResult.ok());
        when(emailService.sendMarketingEmailSync(eq("fail@b.com"), anyString(), anyString()))
                .thenReturn(EmailService.EmailSendResult.failed("provider error"));
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        EmailCampaign result = service.sendCampaign(6L);
        assertThat(result.getStatus()).isEqualTo("PARTIAL");
    }

    @Test
    void sendCampaign_marksFailed_whenAllFail() {
        EmailCampaign campaign = savedCampaign(7L);
        when(campaignRepository.findByIdAndActiveTrue(7L)).thenReturn(Optional.of(campaign));

        EmailCampaignRecipient r = recipient(1L, 7L, "x@b.com");
        when(recipientRepository.findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(7L, "PENDING"))
                .thenReturn(List.of(r));
        when(recipientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(preferenceRepository.findByCustomerId(anyLong())).thenReturn(Optional.empty());
        when(preferenceRepository.save(any())).thenAnswer(inv -> {
            CustomerEmailPreference p = inv.getArgument(0);
            if (p.getUnsubscribeToken() == null) p.setUnsubscribeToken("tok");
            return p;
        });
        when(emailService.sendMarketingEmailSync(anyString(), anyString(), anyString()))
                .thenReturn(EmailService.EmailSendResult.failed("boom"));
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        EmailCampaign result = service.sendCampaign(7L);
        assertThat(result.getStatus()).isEqualTo("FAILED");
    }

    @Test
    void sendCampaign_throwsOnUnknownCampaignId() {
        when(campaignRepository.findByIdAndActiveTrue(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.sendCampaign(99L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // sendCampaign — unsubscribe footer is appended
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void sendCampaign_appendsUnsubscribeLink_toEmailBody() {
        EmailCampaign campaign = savedCampaign(8L);
        when(campaignRepository.findByIdAndActiveTrue(8L)).thenReturn(Optional.of(campaign));

        EmailCampaignRecipient r = recipient(1L, 8L, "a@b.com");
        when(recipientRepository.findByCampaignIdAndStatusAndActiveTrueOrderByCreatedAtAsc(8L, "PENDING"))
                .thenReturn(List.of(r));
        when(recipientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(preferenceRepository.findByCustomerId(anyLong())).thenReturn(Optional.empty());
        when(preferenceRepository.save(any())).thenAnswer(inv -> {
            CustomerEmailPreference p = inv.getArgument(0);
            p.setUnsubscribeToken("fixed-token");
            return p;
        });
        when(emailService.sendMarketingEmailSync(anyString(), anyString(), anyString()))
                .thenReturn(EmailService.EmailSendResult.ok());
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.sendCampaign(8L);

        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendMarketingEmailSync(anyString(), anyString(), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue()).contains("Unsubscribe");
        assertThat(bodyCaptor.getValue()).contains("fixed-token");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private Customer customer(Long id, String name, String email) {
        Customer c = new Customer();
        c.setId(id);
        c.setName(name);
        c.setEmail(email);
        c.setActive(true);
        return c;
    }

    private EmailCampaign savedCampaign(Long id) {
        EmailCampaign c = new EmailCampaign();
        c.setId(id);
        c.setTitle("Test campaign");
        c.setSubject("Test subject");
        c.setBodyText("Hello world");
        c.setStatus("DRAFT");
        c.setSentCount(0);
        c.setFailedCount(0);
        return c;
    }

    private EmailCampaignRecipient recipient(Long id, Long campaignId, String email) {
        EmailCampaignRecipient r = new EmailCampaignRecipient();
        r.setId(id);
        r.setCampaignId(campaignId);
        r.setCustomerId(id);
        r.setEmail(email);
        r.setRecipientName("Customer");
        r.setStatus("PENDING");
        return r;
    }
}
