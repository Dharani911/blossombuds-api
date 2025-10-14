package com.blossombuds.repository;

import com.blossombuds.domain.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/** JPA repository for password reset tokens. */
@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /** Look up a token row by its opaque token string. */
    Optional<PasswordResetToken> findByToken(String token);

    /**
     * Deactivate any still-active, unconsumed tokens for a customer.
     * Used to ensure only one valid token exists at a time.
     */
    @Modifying
    @Query("""
        update PasswordResetToken t
           set t.active = false,
               t.modifiedAt = current_timestamp
         where t.customerId = :customerId
           and t.active = true
           and t.consumedAt is null
    """)
    void deactivateAllByCustomerId(@Param("customerId") Long customerId);
}
