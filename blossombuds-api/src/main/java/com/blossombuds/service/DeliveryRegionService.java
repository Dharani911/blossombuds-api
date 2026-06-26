package com.blossombuds.service;

import com.blossombuds.domain.DeliveryRegion;
import com.blossombuds.domain.StatePartnerAllowlist;
import com.blossombuds.domain.StatePartnerAllowlist.StatePartnerAllowlistId;
import com.blossombuds.repository.DeliveryRegionRepository;
import com.blossombuds.repository.StatePartnerAllowlistRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/** CRUD for delivery regions and the per-state partner allowlist. */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeliveryRegionService {

    private final DeliveryRegionRepository regionRepo;
    private final StatePartnerAllowlistRepository allowlistRepo;

    // ── Regions ───────────────────────────────────────────────────────────────

    public List<DeliveryRegion> listRegions() {
        return regionRepo.findByActiveTrueOrderByNameAsc();
    }

    public DeliveryRegion getRegion(Long id) {
        return regionRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Region not found: " + id));
    }

    @Transactional
    @CacheEvict(value = "deliveryFees", allEntries = true)
    public DeliveryRegion createRegion(String name) {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("Region name is required");
        DeliveryRegion r = new DeliveryRegion();
        r.setName(name.trim());
        r.setActive(true);
        log.info("[REGION][CREATE] name={}", name.trim());
        return regionRepo.save(r);
    }

    @Transactional
    @CacheEvict(value = "deliveryFees", allEntries = true)
    public DeliveryRegion renameRegion(Long id, String name) {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("Region name is required");
        DeliveryRegion r = getRegion(id);
        r.setName(name.trim());
        log.info("[REGION][RENAME] id={} name={}", id, name.trim());
        return regionRepo.save(r);
    }

    @Transactional
    @CacheEvict(value = "deliveryFees", allEntries = true)
    public void deleteRegion(Long id) {
        DeliveryRegion r = getRegion(id);
        regionRepo.delete(r);
        log.info("[REGION][DELETE] id={}", id);
    }

    /** Replace the full set of states for a region. */
    @Transactional
    @CacheEvict(value = "deliveryFees", allEntries = true)
    public DeliveryRegion setRegionStates(Long id, Set<Long> stateIds) {
        DeliveryRegion r = getRegion(id);
        r.getStateIds().clear();
        if (stateIds != null) r.getStateIds().addAll(stateIds);
        log.info("[REGION][STATES] id={} stateCount={}", id, r.getStateIds().size());
        return regionRepo.save(r);
    }

    // ── Allowlist ─────────────────────────────────────────────────────────────

    /** All entries for the given state (may be empty = no restriction). */
    public List<StatePartnerAllowlist> getAllowlistForState(Long stateId) {
        return allowlistRepo.findByIdStateId(stateId);
    }

    /** Partner IDs allowed for the given state (empty list = no restriction). */
    public List<Long> getAllowedPartnerIds(Long stateId) {
        if (!allowlistRepo.existsByIdStateId(stateId)) return List.of();
        return allowlistRepo.findPartnerIdsByStateId(stateId);
    }

    /** Returns true when the state has allowlist restrictions. */
    public boolean stateHasRestrictions(Long stateId) {
        return allowlistRepo.existsByIdStateId(stateId);
    }

    @Transactional
    public StatePartnerAllowlist addAllowlistEntry(Long stateId, Long partnerId) {
        var entryId = new StatePartnerAllowlistId(stateId, partnerId);
        if (allowlistRepo.existsById(entryId)) return allowlistRepo.findById(entryId).orElseThrow();
        log.info("[ALLOWLIST][ADD] stateId={} partnerId={}", stateId, partnerId);
        return allowlistRepo.save(new StatePartnerAllowlist(entryId));
    }

    @Transactional
    public void removeAllowlistEntry(Long stateId, Long partnerId) {
        var entryId = new StatePartnerAllowlistId(stateId, partnerId);
        allowlistRepo.deleteById(entryId);
        log.info("[ALLOWLIST][REMOVE] stateId={} partnerId={}", stateId, partnerId);
    }

    @Transactional
    public void clearAllowlistForState(Long stateId) {
        allowlistRepo.deleteByIdStateId(stateId);
        log.info("[ALLOWLIST][CLEAR] stateId={}", stateId);
    }
}
