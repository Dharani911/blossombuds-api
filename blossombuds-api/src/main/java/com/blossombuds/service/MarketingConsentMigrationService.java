package com.blossombuds.service;

import com.blossombuds.domain.Customer;
import com.blossombuds.domain.CustomerWhatsAppPreference;
import com.blossombuds.repository.CustomerRepository;
import com.blossombuds.repository.CustomerWhatsAppPreferenceRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * One-time migration for customers who registered before the WhatsApp CRM feature existed
 * (before 2026-06-02) and therefore were never shown a WhatsApp/SMS marketing opt-in prompt —
 * today their only path to it is stumbling onto the toggle on their own profile page.
 *
 * Per the updated Terms &amp; Conditions / Privacy Policy (effective {@link #POLICY_EFFECTIVE_DATE}),
 * accepting those terms carries consent to marketing communications. This service notifies each
 * affected customer by email — informational, no click required — and records their consent so
 * they become eligible for WhatsApp/SMS campaigns.
 *
 * Do not send any marketing campaign to the ALL_OPTED_IN audience until on/after
 * {@link #POLICY_EFFECTIVE_DATE} — the notice email promises that date, so campaigns must honor it
 * even though this service flips consent immediately for simplicity (no scheduled-activation job).
 *
 * Safe to re-run: the audience query (see {@link CustomerRepository#findCustomersNeedingWhatsAppConsentMigration})
 * only ever selects customers with no existing preference row, so anyone already migrated —
 * or anyone who has explicitly opted in/out on their own — is never touched twice.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MarketingConsentMigrationService {

    private final CustomerRepository customerRepository;
    private final CustomerWhatsAppPreferenceRepository preferenceRepository;
    private final EmailService emailService;

    @Value("${app.frontend.baseUrl:}")
    private String frontendBase;

    /** Human-readable effective date shown in the notice email and used as the consent source tag.
     *  Update this before running if the actual send date changes. */
    private static final String POLICY_EFFECTIVE_DATE = "22 August 2026";

    /** Returns how many customers are currently eligible, without sending or writing anything. */
    @Transactional(readOnly = true)
    public int countEligible() {
        return customerRepository.findCustomersNeedingWhatsAppConsentMigration().size();
    }

    /** Runs the migration: opts eligible customers in and emails each one the policy notice.
     *  Not @Transactional at the outer level — same reasoning as WhatsAppCampaignService.sendCampaign:
     *  each customer's write commits independently so no connection is held open across N blocking
     *  HTTP calls to the mail provider. */
    public MigrationResult run() {
        List<Customer> eligible = customerRepository.findCustomersNeedingWhatsAppConsentMigration();

        int optedIn = 0;
        int emailFailed = 0;

        String privacyUrl = frontendBase + "/pages/privacy";
        String termsUrl = frontendBase + "/pages/terms";
        String profileUrl = frontendBase + "/profile";

        for (Customer customer : eligible) {
            savePreference(customer);
            optedIn++;

            String subject = "We're updating our Terms & Conditions and Privacy Policy";
            String body = buildNoticeBody(customer.getName(), privacyUrl, termsUrl, profileUrl);

            EmailService.EmailSendResult result =
                    emailService.sendMarketingEmailSync(customer.getEmail(), subject, body);

            if (!result.success()) {
                emailFailed++;
                log.warn("[CONSENT_MIGRATION] Notice email failed for customerId={}: {}",
                        customer.getId(), result.errorMessage());
            }
        }

        log.info("[CONSENT_MIGRATION] Completed: eligible={}, optedIn={}, emailFailed={}",
                eligible.size(), optedIn, emailFailed);

        return new MigrationResult(eligible.size(), optedIn, emailFailed);
    }

    /** Not @Transactional: called via self-invocation from run() in this same class, which bypasses
     *  Spring's transactional proxy — fine here since the single save() below is already atomic on
     *  its own via Spring Data's default per-call transaction (same reasoning as
     *  EmailCampaignService.ensureUnsubscribeUrl). */
    void savePreference(Customer customer) {
        CustomerWhatsAppPreference pref = new CustomerWhatsAppPreference();
        pref.setCustomerId(customer.getId());
        pref.setPhone(customer.getPhone());
        pref.setOptedIn(true);
        pref.setSmsOptedIn(true);
        pref.setSource("POLICY_UPDATE_" + POLICY_EFFECTIVE_DATE.replace(" ", "_").toUpperCase());
        pref.setOptedInAt(OffsetDateTime.now());
        pref.setSmsOptedInAt(OffsetDateTime.now());
        pref.setLastConsentText(
                "Opted in via updated Terms & Conditions / Privacy Policy, effective " + POLICY_EFFECTIVE_DATE);
        pref.setActive(true);
        pref.setCreatedBy("system");
        pref.setModifiedBy("system");
        preferenceRepository.save(pref);
    }

    private String buildNoticeBody(String name, String privacyUrl, String termsUrl, String profileUrl) {
        String safeName = (name == null || name.isBlank()) ? "there" : name.trim();
        return """
            Hi %s,

            We're updating our Terms & Conditions and Privacy Policy — here's what you need to know.

            We're always working to keep you in the loop on the latest from Blossom Buds Floral Artistry. As part of this, our policies now cover how we may reach you with offers, new arrivals, and festival promotions over WhatsApp and SMS, in addition to email.

            From %s, here's what's changing:

            Offers & updates over WhatsApp/SMS
            We may send you occasional offers, new arrivals, and promotions over WhatsApp and SMS, using the contact details on your account.

            {{A|View our updated Privacy Policy|%s}}
            {{A|View our updated Terms & Conditions|%s}}

            Want to change what we get in touch about? Manage your notification preferences anytime from your profile.

            {{A|Manage my notification preferences|%s}}

            Warm regards,
            Blossom Buds Floral Artistry
            """.formatted(safeName, POLICY_EFFECTIVE_DATE, privacyUrl, termsUrl, profileUrl);
    }

    @Getter
    public static class MigrationResult {
        private final int eligible;
        private final int optedIn;
        private final int emailFailed;

        public MigrationResult(int eligible, int optedIn, int emailFailed) {
            this.eligible = eligible;
            this.optedIn = optedIn;
            this.emailFailed = emailFailed;
        }
    }
}
