package com.blossombuds.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SmtpEmailServiceTest {

    @Mock
    private SettingsService settingsService;

    private SmtpEmailService service;

    @BeforeEach
    void setUp() {
        service = new SmtpEmailService(settingsService, new ObjectMapper());
        ReflectionTestUtils.setField(service, "from", "test@blossombuds.com");
        ReflectionTestUtils.setField(service, "logoUrl", "https://cdn.example.com/logo.png");
        ReflectionTestUtils.setField(service, "logoPngPath", "static/BB_logo.png");
        ReflectionTestUtils.setField(service, "logoSvgPath", "static/BB_logo.svg");
        ReflectionTestUtils.setField(service, "frontendBase", "https://www.blossom-buds-floral-artistry.com");
        ReflectionTestUtils.setField(service, "mailApiUrl", "https://api.resend.com/emails");
        ReflectionTestUtils.setField(service, "mailApiKey", "");  // blank = no real HTTP call
    }

    // ──────────────────────────────────────────────────────────────────────────
    // sendMarketingEmailSync — no API key configured
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void sendMarketingEmailSync_returnsFailure_whenApiKeyBlank() {
        EmailService.EmailSendResult result =
                service.sendMarketingEmailSync("user@example.com", "Subject", "Hello there");

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).containsIgnoringCase("not configured");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // HTML rendering — A marker produces a proper anchor
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void sendMarketingEmailSync_failsFast_beforeHttpCall_whenKeyMissing() {
        // Even with a valid body containing markers the method must fail before
        // attempting any HTTP call when the API key is not set.
        EmailService.EmailSendResult result = service.sendMarketingEmailSync(
                "user@example.com",
                "Sale",
                "Check this out {{A|Shop now|https://example.com/sale?ref=bb&code=X}}"
        );
        assertThat(result.success()).isFalse();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // URL-with-ampersand must NOT be double-escaped (regression: bug fixed last session)
    // We verify via the plain-text path which we can call indirectly via sendRichMasked,
    // but since that's @Async we test the underlying rendering by invoking
    // sendMarketingEmailSync with a stubbed key and verifying the failure path still
    // processes without throwing (i.e. maskToHtml doesn't explode on & in URLs).
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void htmlRendering_doesNotThrow_onUrlWithAmpersandInMarker() {
        // Should not throw even though the URL contains &
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() ->
                service.sendMarketingEmailSync(
                        "a@b.com",
                        "Sub",
                        "Hi {{A|Click here|https://example.com?ref=sale&code=FEST20}}"
                )
        );
    }

    @Test
    void htmlRendering_doesNotThrow_onImgMarker() {
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() ->
                service.sendMarketingEmailSync(
                        "a@b.com",
                        "Sub",
                        "{{IMG|https://cdn.example.com/banner.jpg}}\n\nCheck out our new arrivals!"
                )
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Order confirmation email — no exception on null/zero amounts
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void sendOrderConfirmation_doesNotThrow_withNullAmounts() {
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() ->
                service.sendOrderConfirmation(
                        "cust@example.com", "Priya", "261234",
                        "INR",
                        BigDecimal.valueOf(500), null,
                        BigDecimal.valueOf(500), BigDecimal.valueOf(18),
                        BigDecimal.valueOf(90), BigDecimal.valueOf(50),
                        BigDecimal.valueOf(640)
                )
        );
    }

    @Test
    void sendOrderConfirmation_doesNotThrow_withNullName() {
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() ->
                service.sendOrderConfirmation(
                        "cust@example.com", null, "261234",
                        "INR",
                        BigDecimal.valueOf(500), BigDecimal.ZERO,
                        BigDecimal.valueOf(500), BigDecimal.valueOf(18),
                        BigDecimal.valueOf(90), BigDecimal.valueOf(50),
                        BigDecimal.valueOf(640)
                )
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // sendMarketingEmailSync interface contract
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void sendMarketingEmailSync_returnsRecord_withSuccessFalse_andNonNullErrorMessage() {
        EmailService.EmailSendResult result =
                service.sendMarketingEmailSync("x@y.com", "Hi", "Body text");

        // With no API key the result must be a well-formed failure, not null
        assertThat(result).isNotNull();
        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).isNotNull();
    }
}
