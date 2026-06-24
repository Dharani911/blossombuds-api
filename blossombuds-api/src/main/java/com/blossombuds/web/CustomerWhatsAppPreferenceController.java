package com.blossombuds.web;

import com.blossombuds.domain.CustomerWhatsAppPreference;
import com.blossombuds.repository.CustomerWhatsAppPreferenceRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;

/**
 * Customer-accessible endpoints for combined WhatsApp + SMS marketing opt-in preferences.
 * One preference record per customer tracks consent for both channels.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/customers")
public class CustomerWhatsAppPreferenceController {

    private final CustomerWhatsAppPreferenceRepository preferenceRepository;

    /** Returns the current WhatsApp and SMS preference for a customer. */
    @GetMapping("/{customerId}/communication-preference")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public CommunicationPreferenceResponse getPreference(@PathVariable Long customerId,
                                                         Authentication auth) {
        ensureOwnershipOrAdmin(auth, customerId);

        return preferenceRepository.findByCustomerId(customerId)
                .map(this::toResponse)
                .orElse(emptyResponse());
    }

    /**
     * Saves WhatsApp and/or SMS opt-in state for a customer.
     * Sending {@code whatsappOptedIn=true} records WhatsApp consent.
     * Sending {@code smsOptedIn=true} records SMS consent.
     * Either or both can be updated in a single call.
     */
    @PutMapping("/{customerId}/communication-preference")
    @PreAuthorize("hasAnyRole('CUSTOMER','ADMIN')")
    public CommunicationPreferenceResponse savePreference(@PathVariable Long customerId,
                                                          @RequestBody SavePreferenceRequest request,
                                                          Authentication auth) {
        ensureOwnershipOrAdmin(auth, customerId);

        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }

        boolean wantingToOptInEither = Boolean.TRUE.equals(request.getWhatsappOptedIn())
                || Boolean.TRUE.equals(request.getSmsOptedIn());

        if (wantingToOptInEither && isBlank(request.getPhone())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number is required to opt in");
        }

        String source = isBlank(request.getSource()) ? "PROFILE" : request.getSource().toUpperCase();
        OffsetDateTime now = OffsetDateTime.now();

        CustomerWhatsAppPreference pref = preferenceRepository.findByCustomerId(customerId)
                .orElseGet(() -> {
                    CustomerWhatsAppPreference p = new CustomerWhatsAppPreference();
                    p.setCustomerId(customerId);
                    p.setCreatedBy("cust:" + customerId);
                    p.setCreatedAt(now);
                    return p;
                });

        // Update phone if provided — store in E.164 to match CustomerAuthService format
        if (!isBlank(request.getPhone())) {
            pref.setPhone(normalizePhone(request.getPhone()));
        }

        // WhatsApp channel
        if (request.getWhatsappOptedIn() != null) {
            boolean optIn = request.getWhatsappOptedIn();
            pref.setOptedIn(optIn);
            pref.setSource(source);
            if (optIn) {
                pref.setOptedInAt(now);
                pref.setOptedOutAt(null);
            } else {
                pref.setOptedOutAt(now);
            }
        }

        // SMS channel
        if (request.getSmsOptedIn() != null) {
            boolean optIn = request.getSmsOptedIn();
            pref.setSmsOptedIn(optIn);
            if (optIn) {
                pref.setSmsOptedInAt(now);
                pref.setSmsOptedOutAt(null);
            } else {
                pref.setSmsOptedOutAt(now);
            }
        }

        pref.setActive(Boolean.TRUE);
        pref.setModifiedBy("cust:" + customerId);
        pref.setModifiedAt(now);

        CustomerWhatsAppPreference saved = preferenceRepository.save(pref);

        log.info("[COMM_PREF][SAVE] customerId={}, whatsapp={}, sms={}, source={}",
                customerId, saved.getOptedIn(), saved.getSmsOptedIn(), source);

        return toResponse(saved);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private CommunicationPreferenceResponse toResponse(CustomerWhatsAppPreference p) {
        return new CommunicationPreferenceResponse(
                p.getId(),
                p.getPhone(),
                Boolean.TRUE.equals(p.getOptedIn()),
                Boolean.TRUE.equals(p.getSmsOptedIn()),
                p.getSource(),
                p.getOptedInAt(),
                p.getOptedOutAt(),
                p.getSmsOptedInAt(),
                p.getSmsOptedOutAt()
        );
    }

    private CommunicationPreferenceResponse emptyResponse() {
        return new CommunicationPreferenceResponse(null, null, false, false, null, null, null, null, null);
    }

    private void ensureOwnershipOrAdmin(Authentication auth, Long pathCustomerId) {
        if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (isAdmin) return;

        Long authCustomerId = parseCustomerId(auth.getName());
        if (authCustomerId == null || !authCustomerId.equals(pathCustomerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only manage your own preferences");
        }
    }

    private Long parseCustomerId(String principal) {
        try {
            if (principal != null && principal.startsWith("cust:")) {
                return Long.parseLong(principal.substring("cust:".length()));
            }
        } catch (Exception ignored) {}
        return null;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String normalizePhone(String phone) {
        if (isBlank(phone)) return phone;
        String digits = phone.replaceAll("[^0-9]", "");
        if (digits.length() == 10) return "+91" + digits;
        if (digits.length() == 12 && digits.startsWith("91")) return "+" + digits;
        if (digits.length() == 14 && digits.startsWith("0091")) return "+" + digits.substring(2);
        return phone.startsWith("+") ? phone : "+" + digits;
    }

    /** Response DTO for combined communication preferences. */
    public record CommunicationPreferenceResponse(
            Long id,
            String phone,
            boolean whatsappOptedIn,
            boolean smsOptedIn,
            String source,
            OffsetDateTime whatsappOptedInAt,
            OffsetDateTime whatsappOptedOutAt,
            OffsetDateTime smsOptedInAt,
            OffsetDateTime smsOptedOutAt
    ) {}

    /** Request body for saving communication preferences. */
    @Getter
    @Setter
    public static class SavePreferenceRequest {
        /** Phone number in any format — will be normalized to digits only. */
        private String phone;
        /** Set true to opt in, false to opt out. Null means no change to this channel. */
        private Boolean whatsappOptedIn;
        /** Set true to opt in, false to opt out. Null means no change to this channel. */
        private Boolean smsOptedIn;
        /** Capture source: CHECKOUT, PROFILE. Defaults to PROFILE. */
        private String source;
    }
}
