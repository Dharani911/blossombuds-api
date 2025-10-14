package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;
import org.hibernate.annotations.SQLDelete; import org.hibernate.annotations.Where;

import java.time.OffsetDateTime;

/** One-time token for resetting a customer's password. */
@Getter @Setter
@Entity
@Table(name = "password_reset_tokens", indexes = {
        @Index(name = "idx_prt_customer", columnList = "customer_id"),
        @Index(name = "idx_prt_token", columnList = "token")
})
@SQLDelete(sql = "UPDATE password_reset_tokens SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
public class PasswordResetToken {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Column(length = 120, nullable = false)
    private String token;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "consumed_at")
    private OffsetDateTime consumedAt;

    // audit
    private Boolean active = Boolean.TRUE;
    @Column(name = "created_by", length = 120)  private String createdBy;
    @Column(name = "created_at")                private OffsetDateTime createdAt;
    @Column(name = "modified_by", length = 120) private String modifiedBy;
    @Column(name = "modified_at")               private OffsetDateTime modifiedAt;
}
