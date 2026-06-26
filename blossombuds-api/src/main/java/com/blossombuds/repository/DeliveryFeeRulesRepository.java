package com.blossombuds.repository;

import com.blossombuds.domain.DeliveryFeeRules;
import com.blossombuds.domain.DeliveryFeeRules.RuleScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeliveryFeeRulesRepository extends JpaRepository<DeliveryFeeRules, Long> {

    /** Admin list — all active rules, newest first. */
    List<DeliveryFeeRules> findAllByOrderByIdDesc();

    List<DeliveryFeeRules> findAllByActiveTrueOrderByIdDesc();

    // ── Partner-specific lookups (steps 1–4 in hierarchy) ────────────────────

    /** Partner + STATE or DISTRICT (scopeId required). */
    Optional<DeliveryFeeRules> findTopByDeliveryPartnerIdAndScopeAndScopeIdAndActiveTrueOrderByIdDesc(
            Long deliveryPartnerId, RuleScope scope, Long scopeId);

    /** Partner + REGION (regionId required). */
    Optional<DeliveryFeeRules> findTopByDeliveryPartnerIdAndScopeAndRegionIdAndActiveTrueOrderByIdDesc(
            Long deliveryPartnerId, RuleScope scope, Long regionId);

    /** Partner + DEFAULT (no scopeId, no regionId). */
    Optional<DeliveryFeeRules> findTopByDeliveryPartnerIdAndScopeAndScopeIdIsNullAndRegionIdIsNullAndActiveTrueOrderByIdDesc(
            Long deliveryPartnerId, RuleScope scope);

    // ── No-partner fallback lookups (steps 5–8 in hierarchy) ─────────────────

    /** No partner + STATE or DISTRICT (scopeId required). */
    Optional<DeliveryFeeRules> findTopByDeliveryPartnerIdIsNullAndScopeAndScopeIdAndActiveTrueOrderByIdDesc(
            RuleScope scope, Long scopeId);

    /** No partner + REGION (regionId required). */
    Optional<DeliveryFeeRules> findTopByDeliveryPartnerIdIsNullAndScopeAndRegionIdAndActiveTrueOrderByIdDesc(
            RuleScope scope, Long regionId);

    /** No partner + DEFAULT (no scopeId, no regionId). */
    Optional<DeliveryFeeRules> findTopByDeliveryPartnerIdIsNullAndScopeAndScopeIdIsNullAndRegionIdIsNullAndActiveTrueOrderByIdDesc(
            RuleScope scope);

    // ── Legacy queries kept for any callers outside the service ──────────────

    Optional<DeliveryFeeRules> findTopByScopeAndScopeIdOrderByIdDesc(RuleScope scope, Long scopeId);
    Optional<DeliveryFeeRules> findTopByScopeAndScopeIdIsNullOrderByIdDesc(RuleScope scope);
    Optional<DeliveryFeeRules> findTopByScopeAndScopeIdAndActiveTrueOrderByIdDesc(RuleScope scope, Long scopeId);
    Optional<DeliveryFeeRules> findTopByScopeAndScopeIdIsNullAndActiveTrueOrderByIdDesc(RuleScope scope);
    List<DeliveryFeeRules> findByScopeOrderByIdDesc(RuleScope scope);
    List<DeliveryFeeRules> findByScopeAndScopeIdOrderByIdDesc(RuleScope scope, Long scopeId);
}
