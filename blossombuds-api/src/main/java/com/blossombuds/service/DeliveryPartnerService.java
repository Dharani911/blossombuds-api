package com.blossombuds.service;

import com.blossombuds.domain.DeliveryPartner;
import com.blossombuds.dto.DeliveryPartnerDto;
import com.blossombuds.repository.DeliveryPartnerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** Application service for managing delivery/courier partners and their metadata. */
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeliveryPartnerService {

    private final DeliveryPartnerRepository partnerRepo;

    /** Creates a delivery partner from the provided DTO. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public DeliveryPartner create(DeliveryPartnerDto dto, String actor) {
        if (dto == null) throw new IllegalArgumentException("DeliveryPartnerDto is required");
        DeliveryPartner p = new DeliveryPartner();
        p.setCode(safeTrim(dto.getCode()));                    // <— code (not slug)
        p.setName(safeTrim(dto.getName()));
        p.setTrackingUrlTemplate(safeTrim(dto.getTrackingUrlTemplate()));
        p.setActive(dto.getActive() != null ? dto.getActive() : Boolean.TRUE);
        p.setCreatedBy(actor);
        p.setCreatedAt(OffsetDateTime.now());
        return partnerRepo.save(p);
    }

    /** Updates mutable partner fields by id. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public DeliveryPartner update(Long id, DeliveryPartnerDto dto, String actor) {
        if (id == null) throw new IllegalArgumentException("id is required");
        if (dto == null) throw new IllegalArgumentException("DeliveryPartnerDto is required");

        DeliveryPartner p = partnerRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("DeliveryPartner not found: " + id));

        if (dto.getCode() != null)               p.setCode(safeTrim(dto.getCode()));
        if (dto.getName() != null)               p.setName(safeTrim(dto.getName()));
        if (dto.getTrackingUrlTemplate() != null)p.setTrackingUrlTemplate(safeTrim(dto.getTrackingUrlTemplate()));
        if (dto.getActive() != null)             p.setActive(dto.getActive());

        p.setModifiedBy(actor);
        p.setModifiedAt(OffsetDateTime.now());
        return p; // dirty-checked on commit
    }

    /** Returns a partner by id or throws if missing. */
    public DeliveryPartner get(Long id) {
        if (id == null) throw new IllegalArgumentException("id is required");
        return partnerRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("DeliveryPartner not found: " + id));
    }

    /** Returns a partner by unique code. */
    public Optional<DeliveryPartner> getByCode(String code) {
        String c = safeTrim(code);
        if (c == null || c.isEmpty()) return Optional.empty();
        return partnerRepo.findByCode(c); // Ensure repo has this method
    }

    /** Lists all partners (active and inactive). */
    public List<DeliveryPartner> listAll() {
        return partnerRepo.findAll();
    }

    /** Lists only active partners. */
    public List<DeliveryPartner> listActive() {
        return partnerRepo.findByActiveTrue();
    }

    /** Soft-disables or enables a partner. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public DeliveryPartner setActive(Long id, boolean active, String actor) {
        if (id == null) throw new IllegalArgumentException("id is required");
        DeliveryPartner p = get(id);
        p.setActive(active);
        p.setModifiedBy(actor);
        p.setModifiedAt(OffsetDateTime.now());
        return p;
    }

    /** Permanently deletes a partner (prefer setActive(false) to retain history). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(Long id) {
        if (id == null) throw new IllegalArgumentException("id is required");
        partnerRepo.deleteById(id);
    }

    /** Trims a string, returning null if input is null. */
    private static String safeTrim(String s) {
        return s == null ? null : s.trim();
    }
}
