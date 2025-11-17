package com.blossombuds.service;

import com.blossombuds.domain.DeliveryFeeRules;
import com.blossombuds.domain.DeliveryFeeRules.RuleScope;
import com.blossombuds.repository.DeliveryFeeRulesRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
    private static final BigDecimal VERY_LARGE = new BigDecimal("999999999"); // sentinel fallback

    private final DeliveryFeeRulesRepository ruleRepo;
    private final SettingsService settingsService;

    /* ============================ FEE LOOKUP ============================ */

    /** Finds the most specific *active* fee (district → state → default), if any. */
    public Optional<BigDecimal> findEffectiveFee(Long stateId, Long districtId) {
        // District-specific rule (active)
        if (districtId != null) {
            var r = ruleRepo.findTopByScopeAndScopeIdAndActiveTrueOrderByIdDesc(RuleScope.DISTRICT, districtId);
            if (r.isPresent()) {
                log.info("[FEE][DISTRICT] Using district-specific fee for districtId={}", districtId);
                return Optional.of(sanitize(r.get().getFeeAmount()));
            }
        }

        // State-specific rule (active)
        if (stateId != null) {
            var r = ruleRepo.findTopByScopeAndScopeIdAndActiveTrueOrderByIdDesc(RuleScope.STATE, stateId);
            if (r.isPresent()) {
                log.info("[FEE][STATE] Using state-specific fee for stateId={}", stateId);
                return Optional.of(sanitize(r.get().getFeeAmount()));
            }
        }

        // Default rule (active)
        var r = ruleRepo.findTopByScopeAndScopeIdIsNullAndActiveTrueOrderByIdDesc(RuleScope.DEFAULT);
        if (r.isPresent()) {
            log.info("[FEE][DEFAULT] Using default delivery fee");
            return Optional.of(sanitize(r.get().getFeeAmount()));
        }
        log.warn("[FEE][MISSING] No active delivery fee found for stateId={}, districtId={}", stateId, districtId);
        return Optional.empty();
    }

    /** Returns the effective fee or zero when no *active* rule exists. */
    public BigDecimal getEffectiveFeeOrZero(Long stateId, Long districtId) {
        return findEffectiveFee(stateId, districtId).orElse(BigDecimal.ZERO);
    }

    /**
     * Computes the delivery fee considering the free-shipping threshold setting (settings.shipping.free_threshold).
     * If subtotal is null → return effective fee (useful for drafts).
     * If subtotal ≥ threshold → 0; else → effective fee.
     */
    public BigDecimal computeFeeWithThreshold(BigDecimal itemsSubtotal, Long stateId, Long districtId) {
        if (itemsSubtotal == null) {
            log.info("[FEE][THRESHOLD] Subtotal null — returning base fee");
        return getEffectiveFeeOrZero(stateId, districtId);
    }

        var threshold = getBigDecimalSetting(KEY_FREE_THRESHOLD).orElse(VERY_LARGE);
        if (itemsSubtotal.compareTo(threshold) >= 0) {
            log.info("[FEE][THRESHOLD] Subtotal {} >= threshold {} → free shipping", itemsSubtotal, threshold);
            return BigDecimal.ZERO;
        }
        log.info("[FEE][THRESHOLD] Subtotal {} < threshold {} → applying fee", itemsSubtotal, threshold);
        return getEffectiveFeeOrZero(stateId, districtId);
    }

    /* ============================ ADMIN CRUD ============================ */

    /** Newest first is convenient for UI. */
    public List<DeliveryFeeRules> listAllRulesNewestFirst() {
        return ruleRepo.findAllByOrderByIdDesc();
    }

    /** Create a new rule. */
    @Transactional
    public DeliveryFeeRules createRule(DeliveryFeeRules dto) {
        DeliveryFeeRules r = new DeliveryFeeRules();
        applyInto(r, dto);
        log.info("[DELIVERY][CREATE] New rule created: scope={}, scopeId={}", r.getScope(), r.getScopeId());
        return ruleRepo.save(r);
    }

    /** Update an existing rule. */
    @Transactional
    public DeliveryFeeRules updateRule(Long id, DeliveryFeeRules dto) {
        DeliveryFeeRules r = ruleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rule not found: " + id));
        applyInto(r, dto);
        log.info("[DELIVERY][UPDATE] Updated rule id={}", id);
        return ruleRepo.save(r);
    }

    /** Delete a rule. */
    @Transactional
    public void deleteRule(Long id) {
        if (id != null) {
            log.warn("[DELIVERY][DELETE] Deleting rule id={}", id);
            ruleRepo.deleteById(id);
        }
    }
    /* ============================ Helpers ============================ */

    private void applyInto(DeliveryFeeRules target, DeliveryFeeRules src) {
        // Scope
        RuleScope scope = src.getScope() != null ? src.getScope() : RuleScope.DEFAULT;
        target.setScope(scope);

        // scopeId is only meaningful for STATE / DISTRICT; must be null for DEFAULT
        if (scope == RuleScope.DEFAULT) {
            target.setScopeId(null);
        } else {
            target.setScopeId(src.getScopeId());
        }

        // feeAmount (sanitize)
        target.setFeeAmount(sanitize(src.getFeeAmount()));

        // active flag (default true)
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

    /** Normalizes null/negative to zero. */
    private BigDecimal sanitize(BigDecimal v) {
        if (v == null) return BigDecimal.ZERO;
        return v.signum() < 0 ? BigDecimal.ZERO : v;
    }

    /** Utility if you need to parse scope from a string elsewhere. */
    public static RuleScope parseScope(String s) {
        if (s == null) return RuleScope.DEFAULT;
        return switch (s.trim().toUpperCase(Locale.ROOT)) {
            case "STATE" -> RuleScope.STATE;
            case "DISTRICT" -> RuleScope.DISTRICT;
            default -> RuleScope.DEFAULT;
        };
    }
}
