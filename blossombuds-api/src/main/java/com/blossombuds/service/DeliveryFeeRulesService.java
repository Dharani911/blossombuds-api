package com.blossombuds.service;

import com.blossombuds.domain.DeliveryFeeRules;
import com.blossombuds.domain.DeliveryFeeRules.RuleScope;
import com.blossombuds.repository.DeliveryFeeRulesRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;

/** Computes effective delivery fees using district/state/default rules and a free-shipping threshold. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeliveryFeeRulesService {

    private static final String KEY_FREE_THRESHOLD = "shipping.free_threshold";
    private static final BigDecimal VERY_LARGE = new BigDecimal("999999999"); // sentinel fallback

    private final DeliveryFeeRulesRepository ruleRepo;
    private final SettingsService settingsService;

    /** Finds the most specific effective fee (district → state → default), if any. */
    public Optional<BigDecimal> findEffectiveFee(Long stateId, Long districtId) {
        if (districtId != null) {
            var r = ruleRepo.findTopByScopeAndScopeIdOrderByIdDesc(RuleScope.DISTRICT, districtId);
            if (r.isPresent()) return r.map(DeliveryFeeRules::getFeeAmount).map(this::sanitize);
        }
        if (stateId != null) {
            var r = ruleRepo.findTopByScopeAndScopeIdOrderByIdDesc(RuleScope.STATE, stateId);
            if (r.isPresent()) return r.map(DeliveryFeeRules::getFeeAmount).map(this::sanitize);
        }
        return ruleRepo.findTopByScopeAndScopeIdIsNullOrderByIdDesc(RuleScope.DEFAULT)
                .map(DeliveryFeeRules::getFeeAmount)
                .map(this::sanitize);
    }

    /** Returns the effective fee or zero when no rule exists. */
    public BigDecimal getEffectiveFeeOrZero(Long stateId, Long districtId) {
        return findEffectiveFee(stateId, districtId).orElse(BigDecimal.ZERO);
    }

    /** Computes the delivery fee considering the free-shipping threshold setting. */
    public BigDecimal computeFeeWithThreshold(BigDecimal itemsSubtotal, Long stateId, Long districtId) {
        // Null subtotal → just return the effective fee (common during draft carts)
        if (itemsSubtotal == null) return getEffectiveFeeOrZero(stateId, districtId);

        var threshold = getBigDecimalSetting(KEY_FREE_THRESHOLD).orElse(VERY_LARGE);
        if (itemsSubtotal.compareTo(threshold) >= 0) {
            return BigDecimal.ZERO;
        }
        return getEffectiveFeeOrZero(stateId, districtId);
    }

    /** Reads a decimal setting value safely; empty if missing/unparseable/blank. */
    private Optional<BigDecimal> getBigDecimalSetting(String key) {
        try {
            var s = settingsService.get(key); // may throw if key is unknown
            if (s == null || s.getValue() == null) return Optional.empty();
            var raw = s.getValue().trim();
            if (raw.isEmpty()) return Optional.empty();
            return Optional.of(new BigDecimal(raw)).map(this::sanitize);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /** Normalizes negative/NaN-like values to zero (defensive). */
    private BigDecimal sanitize(BigDecimal v) {
        if (v == null) return BigDecimal.ZERO;
        return v.signum() < 0 ? BigDecimal.ZERO : v;
    }
}
