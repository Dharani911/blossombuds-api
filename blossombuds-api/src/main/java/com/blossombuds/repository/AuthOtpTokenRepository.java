package com.blossombuds.repository;

import com.blossombuds.domain.AuthOtpToken;
import com.blossombuds.domain.OtpChannel;
import com.blossombuds.domain.OtpPurpose;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.Optional;

/** Repository for creating and verifying OTP tokens. */
public interface AuthOtpTokenRepository extends JpaRepository<AuthOtpToken, Long> {

    /**
     * Finds the latest unconsumed, unexpired OTP for a destination, channel, and purpose.
     */
    Optional<AuthOtpToken> findTopByDestinationAndChannelAndPurposeAndConsumedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(
            String destination,
            OtpChannel channel,
            OtpPurpose purpose,
            OffsetDateTime now
    );
    Optional<AuthOtpToken> findTopByDestinationAndChannelAndPurposeOrderByCreatedAtDesc(
            String destination,
            OtpChannel channel,
            OtpPurpose purpose
    );
}
