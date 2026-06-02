package com.blossombuds.web;

import com.blossombuds.domain.CustomerWhatsAppPreference;
import com.blossombuds.repository.CustomerWhatsAppPreferenceRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

/** Admin APIs for managing WhatsApp customer opt-in preferences. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/whatsapp/preferences")
public class AdminWhatsAppPreferenceController {

    private final CustomerWhatsAppPreferenceRepository preferenceRepository;

    /** Lists all active WhatsApp preferences ordered by latest first. */
    @GetMapping
    public List<CustomerWhatsAppPreference> listPreferences() {
        return preferenceRepository.findByActiveTrueOrderByCreatedAtDesc();
    }

    /** Creates or updates a manual WhatsApp opt-in preference for testing campaigns. */
    @PostMapping("/manual")
    public CustomerWhatsAppPreference createManualPreference(@RequestBody ManualPreferenceRequest request) {
        String phone = normalizePhone(request.getPhone());

        if (phone.isBlank()) {
            throw new IllegalArgumentException("Phone number is required");
        }

        CustomerWhatsAppPreference preference = preferenceRepository.findByPhoneAndActiveTrue(phone)
                .orElseGet(CustomerWhatsAppPreference::new);

        preference.setCustomerId(request.getCustomerId());
        preference.setPhone(phone);
        preference.setOptedIn(Boolean.TRUE);
        preference.setSource("ADMIN_MANUAL");
        preference.setOptedInAt(OffsetDateTime.now());
        preference.setOptedOutAt(null);
        preference.setActive(Boolean.TRUE);

        if (preference.getId() == null) {
            preference.setCreatedBy("admin");
            preference.setCreatedAt(OffsetDateTime.now());
        }

        preference.setModifiedBy("admin");
        preference.setModifiedAt(OffsetDateTime.now());

        return preferenceRepository.save(preference);
    }

    /** Disables one WhatsApp preference without deleting history. */
    @DeleteMapping("/{id}")
    public void disablePreference(@PathVariable Long id) {
        preferenceRepository.findById(id).ifPresent(preference -> {
            preference.setOptedIn(Boolean.FALSE);
            preference.setActive(Boolean.FALSE);
            preference.setOptedOutAt(OffsetDateTime.now());
            preference.setModifiedBy("admin");
            preference.setModifiedAt(OffsetDateTime.now());
            preferenceRepository.save(preference);
        });
    }

    /** Normalizes phone number before storing it for WhatsApp sending. */
    private String normalizePhone(String phone) {
        if (phone == null) {
            return "";
        }

        return phone
                .replace("+", "")
                .replace(" ", "")
                .replace("-", "")
                .trim();
    }

    /** Request body for manually creating a WhatsApp preference. */
    @Getter
    @Setter
    public static class ManualPreferenceRequest {

        /** Optional customer id linked to the preference. */
        private Long customerId;

        /** WhatsApp phone number in international format. */
        private String phone;
    }
}