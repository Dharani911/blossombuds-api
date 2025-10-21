package com.blossombuds.repository;

import com.blossombuds.domain.DeliveryFeeRules;
import com.blossombuds.domain.DeliveryFeeRules.RuleScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Delivery fee rules repository.
 *
 * Notes:
 * - The service currently checks the rule's `active` flag,
 *   so these non-filtered methods are required as-is.
 * - Active-only variants are provided for convenience.
 */
@Repository
public interface DeliveryFeeRulesRepository extends JpaRepository<DeliveryFeeRules, Long> {

    /* ===== Methods used by DeliveryFeeRulesService ===== */

    /** Most recent (highest id) rule for a specific district/state. */
    Optional<DeliveryFeeRules> findTopByScopeAndScopeIdOrderByIdDesc(RuleScope scope, Long scopeId);

    /** Most recent DEFAULT-scope rule (scopeId = null). */
    Optional<DeliveryFeeRules> findTopByScopeAndScopeIdIsNullOrderByIdDesc(RuleScope scope);

    /** List all rules newest-first (useful for admin list). */
    List<DeliveryFeeRules> findAllByOrderByIdDesc();


    /* ===== Optional convenience methods (not required by the service) ===== */

    /** Active-only variants (use if you want repo to filter `active = true`). */
    Optional<DeliveryFeeRules> findTopByScopeAndScopeIdAndActiveTrueOrderByIdDesc(RuleScope scope, Long scopeId);
    Optional<DeliveryFeeRules> findTopByScopeAndScopeIdIsNullAndActiveTrueOrderByIdDesc(RuleScope scope);

    /** Filtered lists for admin views, newest-first. */
    List<DeliveryFeeRules> findByScopeOrderByIdDesc(RuleScope scope);
    List<DeliveryFeeRules> findByScopeAndScopeIdOrderByIdDesc(RuleScope scope, Long scopeId);
    List<DeliveryFeeRules> findAllByActiveTrueOrderByIdDesc();
}
