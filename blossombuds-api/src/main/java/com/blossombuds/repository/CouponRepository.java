package com.blossombuds.repository;

import com.blossombuds.domain.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/** Repository for coupons. */
public interface CouponRepository extends JpaRepository<Coupon, Long> {

    /** Finds an active coupon by code (case-sensitive to match DB). */
    Optional<Coupon> findByCodeIgnoreCaseAndActiveTrue(String code);

    /** Checks if a coupon code is already in use. */
    boolean existsByCode(String code);
    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);

    Optional<Coupon> findByCodeIgnoreCase(String code);

    /** Case-insensitive lookup, restricted to active coupons. */


    /** JPQL equivalent (useful if your DB collation is tricky). */
    @Query("select c from Coupon c where lower(c.code) = lower(:code)")
    Optional<Coupon> findByCodeCi(@Param("code") String code);
}
