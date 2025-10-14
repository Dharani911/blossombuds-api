package com.blossombuds.repository;

import com.blossombuds.domain.DeliveryFeeRules;
import com.blossombuds.domain.DeliveryFeeRules.RuleScope;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * CRUD + quick lookups for delivery fee rules.
 * Note: @Where(active = true) on the entity ensures only active rows are returned.
 */
public interface DeliveryFeeRulesRepository extends JpaRepository<DeliveryFeeRules, Long> {

    /** Latest rule for a (scope, scopeId) pair — used for STATE/DISTRICT. */
    Optional<DeliveryFeeRules> findTopByScopeAndScopeIdOrderByIdDesc(RuleScope scope, Long scopeId);

    /** Latest DEFAULT rule (scope=DEFAULT, scope_id IS NULL). */
    Optional<DeliveryFeeRules> findTopByScopeAndScopeIdIsNullOrderByIdDesc(RuleScope scope);
}
