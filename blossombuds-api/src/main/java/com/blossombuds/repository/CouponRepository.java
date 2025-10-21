package com.blossombuds.repository;

import com.blossombuds.domain.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** Repository for coupons. */
public interface CouponRepository extends JpaRepository<Coupon, Long> {

    /** Finds an active coupon by code (case-sensitive to match DB). */
    Optional<Coupon> findByCodeIgnoreCaseAndActiveTrue(String code);

    /** Checks if a coupon code is already in use. */
    boolean existsByCode(String code);
    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);
}
