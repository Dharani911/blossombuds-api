package com.blossombuds.service;

import com.blossombuds.domain.DeliveryPartner;
import com.blossombuds.repository.DeliveryPartnerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Builds a tracking URL from the partner's template and tracking number. */
@Service
@RequiredArgsConstructor
public class TrackingLinkService {

    private final DeliveryPartnerRepository partnerRepo;

    /** Returns a tracking URL if partner + number present; otherwise null. */
    public String buildTrackingUrl(Long deliveryPartnerId, String trackingNumber) {
        if (deliveryPartnerId == null || trackingNumber == null || trackingNumber.isBlank()) return null;
        DeliveryPartner p = partnerRepo.findById(deliveryPartnerId)
                .orElse(null);
        if (p == null || p.getTrackingUrlTemplate() == null || p.getTrackingUrlTemplate().isBlank()) return null;

        // Replace common placeholders; default to {tracking}
        String url = p.getTrackingUrlTemplate();
        url = url.replace("{tracking}", trackingNumber.trim());
        url = url.replace("{TRACKING}", trackingNumber.trim());
        return url;
    }
}
