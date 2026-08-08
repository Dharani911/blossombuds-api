package com.blossombuds.web;

import com.blossombuds.domain.CustomerEmailPreference;
import com.blossombuds.repository.CustomerEmailPreferenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

/** Public, unauthenticated one-click unsubscribe link included in every marketing email.
 *  Reachable without login via the existing GET /api/public/** permitAll security rule. */
@Slf4j
@RestController
@RequiredArgsConstructor
public class EmailUnsubscribeController {

    private final CustomerEmailPreferenceRepository preferenceRepository;

    @GetMapping(value = "/api/public/email-preference/unsubscribe", produces = MediaType.TEXT_HTML_VALUE)
    @Transactional
    public String unsubscribe(@RequestParam String token) {
        CustomerEmailPreference pref = preferenceRepository.findByUnsubscribeToken(token).orElse(null);

        if (pref == null) {
            return page("This unsubscribe link is invalid or has expired.");
        }

        if (!Boolean.TRUE.equals(pref.getUnsubscribed())) {
            pref.setUnsubscribed(true);
            pref.setUnsubscribedAt(OffsetDateTime.now());
            pref.setModifiedBy("customer-unsubscribe");
            pref.setModifiedAt(OffsetDateTime.now());
            preferenceRepository.save(pref);
            log.info("[EMAIL][UNSUBSCRIBE] customerId={} email={}", pref.getCustomerId(), pref.getEmail());
        }

        return page("You've been unsubscribed from marketing emails. You'll still receive order and account emails.");
    }

    private String page(String message) {
        return """
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8"/>
              <meta name="viewport" content="width=device-width, initial-scale=1"/>
              <title>Blossom Buds Floral Artistry</title>
            </head>
            <body style="margin:0; padding:40px 20px; background:#faf9fb; color:#2b2b2b; font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; text-align:center;">
              <div style="max-width:480px; margin:0 auto; background:#fff; border:1px solid #eee; border-radius:12px; padding:28px; box-shadow:0 8px 24px rgba(0,0,0,.06);">
                <h1 style="margin:0 0 12px; font:600 18px/1.3 'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#4A4F41;">Blossom Buds Floral Artistry</h1>
                <p style="margin:0; color:#2b2b2b;">%s</p>
              </div>
            </body>
            </html>
            """.formatted(message);
    }
}
