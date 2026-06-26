package com.blossombuds.web;

import com.blossombuds.domain.DeliveryRegion;
import com.blossombuds.domain.StatePartnerAllowlist;
import com.blossombuds.service.DeliveryRegionService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/shipping/regions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DeliveryRegionAdminController {

    private final DeliveryRegionService regionService;

    // ── Regions ───────────────────────────────────────────────────────────────

    @GetMapping
    public List<DeliveryRegion> listRegions() {
        return regionService.listRegions();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DeliveryRegion createRegion(@RequestBody NameRequest req) {
        return regionService.createRegion(req.getName());
    }

    @PatchMapping("/{id}")
    public DeliveryRegion renameRegion(@PathVariable Long id, @RequestBody NameRequest req) {
        return regionService.renameRegion(id, req.getName());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRegion(@PathVariable Long id) {
        regionService.deleteRegion(id);
    }

    /** Replace the full set of states for a region. */
    @PutMapping("/{id}/states")
    public DeliveryRegion setStates(@PathVariable Long id, @RequestBody StateIdsRequest req) {
        return regionService.setRegionStates(id, req.getStateIds());
    }

    // ── Allowlist ─────────────────────────────────────────────────────────────

    @GetMapping("/allowlist/{stateId}")
    public List<StatePartnerAllowlist> getAllowlist(@PathVariable Long stateId) {
        return regionService.getAllowlistForState(stateId);
    }

    @PostMapping("/allowlist")
    @ResponseStatus(HttpStatus.CREATED)
    public StatePartnerAllowlist addAllowlist(@RequestBody AllowlistRequest req) {
        return regionService.addAllowlistEntry(req.getStateId(), req.getDeliveryPartnerId());
    }

    @DeleteMapping("/allowlist/{stateId}/{partnerId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeAllowlist(@PathVariable Long stateId, @PathVariable Long partnerId) {
        regionService.removeAllowlistEntry(stateId, partnerId);
    }

    @DeleteMapping("/allowlist/{stateId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearAllowlist(@PathVariable Long stateId) {
        regionService.clearAllowlistForState(stateId);
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    @Data static class NameRequest { private String name; }
    @Data static class StateIdsRequest { private Set<Long> stateIds; }
    @Data static class AllowlistRequest {
        private Long stateId;
        private Long deliveryPartnerId;
    }
}
