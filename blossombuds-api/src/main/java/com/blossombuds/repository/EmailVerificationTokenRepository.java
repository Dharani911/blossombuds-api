package com.blossombuds.repository;

import com.blossombuds.domain.EmailVerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {
    Optional<EmailVerificationToken> findByToken(String token);

    @Modifying
    @Query("update EmailVerificationToken t set t.active = false where t.customerId = :customerId and t.active = true")
    int deactivateActiveTokensForCustomer(@Param("customerId") Long customerId);
}
