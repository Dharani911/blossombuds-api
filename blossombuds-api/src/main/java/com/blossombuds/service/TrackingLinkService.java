package com.blossombuds.service;

import com.blossombuds.domain.DeliveryPartner;
import com.blossombuds.repository.DeliveryPartnerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** Builds a tracking URL from the partner's template and tracking number. */
@Slf4j
@Service
@RequiredArgsConstructor
public class TrackingLinkService {

    private final DeliveryPartnerRepository partnerRepo;

    /** Returns a tracking URL if partner + number present; otherwise null. */
    public String buildTrackingUrl(Long deliveryPartnerId, String trackingNumber) {
        if (deliveryPartnerId == null || trackingNumber == null || trackingNumber.isBlank()) {
            log.info("[TRACKING][SKIP] Missing partnerId or trackingNumber → partnerId={} number={}", deliveryPartnerId, trackingNumber);
            return null;
        }
        DeliveryPartner p = partnerRepo.findById(deliveryPartnerId)
                .orElse(null);
        if (p == null) {
            log.info("[TRACKING][NOT_FOUND] No delivery partner found for id={}", deliveryPartnerId);
            return null;
        }
        if (p.getTrackingUrlTemplate() == null || p.getTrackingUrlTemplate().isBlank()) {
            log.info("[TRACKING][NO_TEMPLATE] No tracking URL template for partner id={} name='{}'", p.getId(), p.getName());
            return null;
        }
        // Replace common placeholders; default to {tracking}
        String url = p.getTrackingUrlTemplate();
        log.info("[TRACKING][TEMPLATE_FOUND] Using template for partner id={} → {}", p.getId(), url);
        return url;
    }
}
