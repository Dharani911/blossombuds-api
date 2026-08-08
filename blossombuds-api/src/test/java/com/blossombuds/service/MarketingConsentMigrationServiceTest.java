package com.blossombuds.service;

import com.blossombuds.domain.*;
import com.blossombuds.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MarketingConsentMigrationServiceTest {

    @Mock private CustomerRepository customerRepository;
    @Mock private CustomerWhatsAppPreferenceRepository preferenceRepository;
    @Mock private EmailService emailService;

    private MarketingConsentMigrationService service;

    @BeforeEach
    void setUp() {
        service = new MarketingConsentMigrationService(
                customerRepository, preferenceRepository, emailService);
        ReflectionTestUtils.setField(service, "frontendBase", "https://www.blossom-buds-floral-artistry.com");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // run — basic counts
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void run_optsInAllEligibleCustomers() {
        when(customerRepository.findCustomersNeedingWhatsAppConsentMigration())
                .thenReturn(List.of(
                        customer(1L, "Priya", "priya@example.com", "+919876543210"),
                        customer(2L, "Ravi",  "ravi@example.com",  "+919988776655")));
        when(emailService.sendMarketingEmailSync(anyString(), anyString(), anyString()))
                .thenReturn(EmailService.EmailSendResult.ok());

        MarketingConsentMigrationService.MigrationResult result = service.run();

        assertThat(result.getEligible()).isEqualTo(2);
        assertThat(result.getOptedIn()).isEqualTo(2);
        assertThat(result.getEmailFailed()).isEqualTo(0);
        verify(preferenceRepository, times(2)).save(any(CustomerWhatsAppPreference.class));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // run — phone-only customer: opt in happens, email is skipped (no NPE)
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void run_skipsNoticeEmail_forPhoneOnlyCustomer_butStillOptsIn() {
        Customer phoneOnly = customer(3L, "Meena", null, "+919123456789");
        when(customerRepository.findCustomersNeedingWhatsAppConsentMigration())
                .thenReturn(List.of(phoneOnly));

        MarketingConsentMigrationService.MigrationResult result = service.run();

        assertThat(result.getOptedIn()).isEqualTo(1);
        assertThat(result.getEmailFailed()).isEqualTo(0);
        // Preference row must be saved
        verify(preferenceRepository).save(any(CustomerWhatsAppPreference.class));
        // Email must NOT be sent
        verifyNoInteractions(emailService);
    }

    @Test
    void run_skipsNoticeEmail_forBlankEmailCustomer() {
        Customer blankEmail = customer(4L, "Kumar", "  ", "+919000000000");
        when(customerRepository.findCustomersNeedingWhatsAppConsentMigration())
                .thenReturn(List.of(blankEmail));

        service.run();
        verifyNoInteractions(emailService);
        verify(preferenceRepository).save(any());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // run — email failure is counted but does NOT abort remaining customers
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void run_countsEmailFailures_andContinuesToNextCustomer() {
        when(customerRepository.findCustomersNeedingWhatsAppConsentMigration())
                .thenReturn(List.of(
                        customer(5L, "A", "a@x.com", "+91111"),
                        customer(6L, "B", "b@x.com", "+91222")));
        when(emailService.sendMarketingEmailSync(eq("a@x.com"), anyString(), anyString()))
                .thenReturn(EmailService.EmailSendResult.failed("provider down"));
        when(emailService.sendMarketingEmailSync(eq("b@x.com"), anyString(), anyString()))
                .thenReturn(EmailService.EmailSendResult.ok());

        MarketingConsentMigrationService.MigrationResult result = service.run();

        assertThat(result.getOptedIn()).isEqualTo(2);    // both still opted in
        assertThat(result.getEmailFailed()).isEqualTo(1);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // run — empty eligible list
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void run_returnsZeroCounts_whenNoEligibleCustomers() {
        when(customerRepository.findCustomersNeedingWhatsAppConsentMigration()).thenReturn(List.of());

        MarketingConsentMigrationService.MigrationResult result = service.run();

        assertThat(result.getEligible()).isEqualTo(0);
        assertThat(result.getOptedIn()).isEqualTo(0);
        assertThat(result.getEmailFailed()).isEqualTo(0);
        verifyNoInteractions(preferenceRepository, emailService);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // savePreference — fields set correctly
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void savePreference_setsOptedInAndPhone() {
        Customer c = customer(10L, "Divya", "d@x.com", "+919700000000");

        service.savePreference(c);

        var captor = org.mockito.ArgumentCaptor.forClass(CustomerWhatsAppPreference.class);
        verify(preferenceRepository).save(captor.capture());

        CustomerWhatsAppPreference saved = captor.getValue();
        assertThat(saved.getCustomerId()).isEqualTo(10L);
        assertThat(saved.getPhone()).isEqualTo("+919700000000");
        assertThat(saved.getOptedIn()).isTrue();
        assertThat(saved.getSmsOptedIn()).isTrue();
        assertThat(saved.getActive()).isTrue();
        assertThat(saved.getSource()).startsWith("POLICY_UPDATE_");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // countEligible — delegates to repository
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void countEligible_returnsRepositorySize() {
        when(customerRepository.findCustomersNeedingWhatsAppConsentMigration())
                .thenReturn(List.of(customer(1L, "X", "x@x.com", "+1"), customer(2L, "Y", "y@y.com", "+2")));

        assertThat(service.countEligible()).isEqualTo(2);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private Customer customer(Long id, String name, String email, String phone) {
        Customer c = new Customer();
        c.setId(id);
        c.setName(name);
        c.setEmail(email);
        c.setPhone(phone);
        c.setActive(true);
        return c;
    }
}
