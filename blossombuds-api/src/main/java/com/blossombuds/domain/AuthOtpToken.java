package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Stores one-time passcodes for email/phone based authentication flows. */
@Getter
@Setter
@Entity
@Table(
        name = "auth_otp_tokens",
        indexes = {
                @Index(
                        name = "idx_auth_otp_tokens_lookup",
                        columnList = "destination, channel, purpose, consumed_at"
                ),
                @Index(
                        name = "idx_auth_otp_tokens_expires_at",
                        columnList = "expires_at"
                )
        }
)
public class AuthOtpToken {

    /** Surrogate primary key for the OTP token. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Optional link to the customer this token belongs to (can be null for first-time signups). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "customer_id",
            foreignKey = @ForeignKey(name = "fk_auth_otp_tokens_customer")
    )
    private Customer customer;

    /** Delivery channel used to send this OTP (email or phone). */
    @Enumerated(EnumType.STRING)
    @Column(name = "channel", length = 20, nullable = false)
    private OtpChannel channel;

    /** Normalized email address or phone number the OTP was sent to. */
    @Column(name = "destination", length = 180, nullable = false)
    private String destination;

    /** OTP code value (for example a 6-digit numeric code). */
    @Column(name = "code", length = 10, nullable = false)
    private String code;

    /** Purpose of this OTP such as LOGIN, SIGNUP or FORGOT_PASSWORD. */
    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", length = 40, nullable = false)
    private OtpPurpose purpose;

    /** Expiry timestamp after which the OTP is no longer valid. */
    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    /** Timestamp when the OTP was consumed; null means not yet used. */
    @Column(name = "consumed_at")
    private OffsetDateTime consumedAt;

    /** Creation timestamp for this OTP entry. */
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
