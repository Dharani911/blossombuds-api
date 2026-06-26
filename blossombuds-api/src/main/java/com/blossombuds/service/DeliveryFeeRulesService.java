package com.blossombuds.service;

import com.blossombuds.domain.DeliveryFeeRules;
import com.blossombuds.domain.DeliveryFeeRules.RuleScope;
import com.blossombuds.repository.DeliveryFeeRulesRepository;
import com.blossombuds.repository.DeliveryPartnerRepository;
import com.blossombuds.repository.DeliveryRegionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** Computes effective delivery fees and exposes simple CRUD for rules. */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeliveryFeeRulesService {

    private static final String KEY_FREE_THRESHOLD = "shipping.free_threshold";
    private static final BigDecimal VERY_LARGE = new BigDecimal("999999999");

    private final DeliveryFeeRulesRepository ruleRepo;
    private final DeliveryRegionRepository regionRepo;
    private final DeliveryPartnerRepository partnerRepo;
    private final SettingsService settingsService;

    // ── Fee lookup ────────────────────────────────────────────────────────────

    /**
     * 8-step partner-aware hierarchy:
     *   With partner:    DISTRICT → STATE → REGION → DEFAULT
     *   Without partner: DISTRICT → STATE → REGION → DEFAULT
     */
    @Cacheable(
            value = "deliveryFees",
            key = "'p=' + #partnerId + ':s=' + #stateId + ':d=' + #districtId",
            unless = "#result == null || !#result.isPresent()"
    )
    public Optional<BigDecimal> findEffectiveFee(Long stateId, Long districtId, Long partnerId) {

        if (partnerId != null) {
            // 1. partner + DISTRICT
            if (districtId != null) {
                var r = ruleRepo.findTopByDeliveryPartnerIdAndScopeAndScopeIdAndActiveTrueOrderByIdDesc(
                        partnerId, RuleScope.DISTRICT, districtId);
                if (r.isPresent()) {
                    log.info("[FEE] p={} DISTRICT={}", partnerId, districtId);
                    return Optional.of(sanitize(r.get().getFeeAmount()));
                }
            }
            // 2. partner + STATE
            if (stateId != null) {
                var r = ruleRepo.findTopByDeliveryPartnerIdAndScopeAndScopeIdAndActiveTrueOrderByIdDesc(
                        partnerId, RuleScope.STATE, stateId);
                if (r.isPresent()) {
                    log.info("[FEE] p={} STATE={}", partnerId, stateId);
                    return Optional.of(sanitize(r.get().getFeeAmount()));
                }
            }
            // 3. partner + REGION
            if (stateId != null) {
                List<Long> regionIds = regionRepo.findActiveRegionIdsByStateId(stateId);
                for (Long rid : regionIds) {
                    var r = ruleRepo.findTopByDeliveryPartnerIdAndScopeAndRegionIdAndActiveTrueOrderByIdDesc(
                            partnerId, RuleScope.REGION, rid);
                    if (r.isPresent()) {
                        log.info("[FEE] p={} REGION={}", partnerId, rid);
                        return Optional.of(sanitize(r.get().getFeeAmount()));
                    }
                }
            }
            // 4. partner + DEFAULT
            var r = ruleRepo.findTopByDeliveryPartnerIdAndScopeAndScopeIdIsNullAndRegionIdIsNullAndActiveTrueOrderByIdDesc(
                    partnerId, RuleScope.DEFAULT);
            if (r.isPresent()) {
                log.info("[FEE] p={} DEFAULT", partnerId);
                return Optional.of(sanitize(r.get().getFeeAmount()));
            }
        }

        // 5. no-partner + DISTRICT
        if (districtId != null) {
            var r = ruleRepo.findTopByDeliveryPartnerIdIsNullAndScopeAndScopeIdAndActiveTrueOrderByIdDesc(
                    RuleScope.DISTRICT, districtId);
            if (r.isPresent()) {
                log.info("[FEE] no-partner DISTRICT={}", districtId);
                return Optional.of(sanitize(r.get().getFeeAmount()));
            }
        }
        // 6. no-partner + STATE
        if (stateId != null) {
            var r = ruleRepo.findTopByDeliveryPartnerIdIsNullAndScopeAndScopeIdAndActiveTrueOrderByIdDesc(
                    RuleScope.STATE, stateId);
            if (r.isPresent()) {
                log.info("[FEE] no-partner STATE={}", stateId);
                return Optional.of(sanitize(r.get().getFeeAmount()));
            }
        }
        // 7. no-partner + REGION
        if (stateId != null) {
            List<Long> regionIds = regionRepo.findActiveRegionIdsByStateId(stateId);
            for (Long rid : regionIds) {
                var r = ruleRepo.findTopByDeliveryPartnerIdIsNullAndScopeAndRegionIdAndActiveTrueOrderByIdDesc(
                        RuleScope.REGION, rid);
                if (r.isPresent()) {
                    log.info("[FEE] no-partner REGION={}", rid);
                    return Optional.of(sanitize(r.get().getFeeAmount()));
                }
            }
        }
        // 8. no-partner + DEFAULT
        var r = ruleRepo.findTopByDeliveryPartnerIdIsNullAndScopeAndScopeIdIsNullAndRegionIdIsNullAndActiveTrueOrderByIdDesc(
                RuleScope.DEFAULT);
        if (r.isPresent()) {
            log.info("[FEE] no-partner DEFAULT");
            return Optional.of(sanitize(r.get().getFeeAmount()));
        }

        log.warn("[FEE] No rule found for stateId={} districtId={} partnerId={}", stateId, districtId, partnerId);
        return Optional.empty();
    }

    public BigDecimal computeFee(
            BigDecimal itemsSubtotal,
            Long stateId,
            Long districtId,
            Long deliveryPartnerId
    ) {
        boolean overridesThreshold = deliveryPartnerId != null &&
                partnerRepo.findById(deliveryPartnerId)
                        .map(p -> Boolean.TRUE.equals(p.getOverrideFreeShipping()))
                        .orElse(false);

        if (!overridesThreshold && isThresholdFreeShippingEligible(itemsSubtotal)) {
            log.info("[FEE][THRESHOLD] threshold met -> free shipping");
            return BigDecimal.ZERO;
        }
        return findEffectiveFee(stateId, districtId, deliveryPartnerId).orElse(BigDecimal.ZERO);
    }

    public boolean isThresholdFreeShippingEligible(BigDecimal itemsSubtotal) {
        if (itemsSubtotal == null) return false;
        var threshold = getBigDecimalSetting(KEY_FREE_THRESHOLD).orElse(VERY_LARGE);
        return itemsSubtotal.compareTo(threshold) >= 0;
    }

    public BigDecimal getEffectiveFeeOrZero(Long stateId, Long districtId) {
        return findEffectiveFee(stateId, districtId, null).orElse(BigDecimal.ZERO);
    }

    public BigDecimal computeFeeWithThreshold(BigDecimal itemsSubtotal, Long stateId, Long districtId) {
        if (itemsSubtotal == null) return getEffectiveFeeOrZero(stateId, districtId);
        var threshold = getBigDecimalSetting(KEY_FREE_THRESHOLD).orElse(VERY_LARGE);
        if (itemsSubtotal.compareTo(threshold) >= 0) return BigDecimal.ZERO;
        return getEffectiveFeeOrZero(stateId, districtId);
    }

    // ── Admin CRUD ────────────────────────────────────────────────────────────

    public List<DeliveryFeeRules> listAllRulesNewestFirst() {
        return ruleRepo.findAllByOrderByIdDesc();
    }

    @Transactional
    @CacheEvict(value = "deliveryFees", allEntries = true)
    public DeliveryFeeRules createRule(DeliveryFeeRules dto) {
        DeliveryFeeRules r = new DeliveryFeeRules();
        applyInto(r, dto);
        log.info("[RULE][CREATE] scope={} scopeId={} regionId={} partnerId={}",
                r.getScope(), r.getScopeId(), r.getRegionId(), r.getDeliveryPartnerId());
        return ruleRepo.save(r);
    }

    @Transactional
    @CacheEvict(value = "deliveryFees", allEntries = true)
    public DeliveryFeeRules updateRule(Long id, DeliveryFeeRules dto) {
        DeliveryFeeRules r = ruleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rule not found: " + id));
        applyInto(r, dto);
        log.info("[RULE][UPDATE] id={}", id);
        return ruleRepo.save(r);
    }

    @Transactional
    @CacheEvict(value = "deliveryFees", allEntries = true)
    public void deleteRule(Long id) {
        if (id != null) {
            log.warn("[RULE][DELETE] id={}", id);
            ruleRepo.deleteById(id);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void applyInto(DeliveryFeeRules target, DeliveryFeeRules src) {
        RuleScope scope = src.getScope() != null ? src.getScope() : RuleScope.DEFAULT;
        target.setScope(scope);

        switch (scope) {
            case DEFAULT -> {
                target.setScopeId(null);
                target.setRegionId(null);
            }
            case REGION -> {
                target.setScopeId(null);
                target.setRegionId(src.getRegionId());
            }
            default -> {
                // STATE or DISTRICT
                target.setScopeId(src.getScopeId());
                target.setRegionId(null);
            }
        }

        target.setDeliveryPartnerId(src.getDeliveryPartnerId());
        target.setFeeAmount(sanitize(src.getFeeAmount()));
        target.setActive(src.getActive() != null ? src.getActive() : Boolean.TRUE);
    }

    private Optional<BigDecimal> getBigDecimalSetting(String key) {
        try {
            var s = settingsService.get(key);
            if (s == null || s.getValue() == null) return Optional.empty();
            var raw = s.getValue().trim();
            if (raw.isEmpty()) return Optional.empty();
            return Optional.of(new BigDecimal(raw)).map(this::sanitize);
        } catch (Exception e) {
            log.error("[SETTINGS][ERROR] Failed to parse setting {} as BigDecimal", key, e);
            return Optional.empty();
        }
    }

    private BigDecimal sanitize(BigDecimal v) {
        if (v == null) return BigDecimal.ZERO;
        return v.signum() < 0 ? BigDecimal.ZERO : v;
    }

    public static RuleScope parseScope(String s) {
        if (s == null) return RuleScope.DEFAULT;
        return switch (s.trim().toUpperCase(Locale.ROOT)) {
            case "STATE" -> RuleScope.STATE;
            case "DISTRICT" -> RuleScope.DISTRICT;
            case "REGION" -> RuleScope.REGION;
            default -> RuleScope.DEFAULT;
        };
    }
}
