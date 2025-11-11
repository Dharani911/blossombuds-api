package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;
import org.hibernate.annotations.SQLDelete; import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** One-time token for resetting a customer's password. */
@Getter @Setter
@Entity
@Table(name = "password_reset_tokens", indexes = {
        @Index(name = "idx_prt_customer", columnList = "customer_id"),
        @Index(name = "idx_prt_token", columnList = "token")
})
@EntityListeners(AuditingEntityListener.class)
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
    @Column(name = "created_by", length = 120)
    @CreatedBy
    private String createdBy;

    @Column(name = "created_at")
    @CreatedDate
    private LocalDateTime createdAt;

    @Column(name = "modified_by", length = 120)
    @LastModifiedBy
    private String modifiedBy;

    /** Timestamp when the record was last modified. */
    @Column(name = "modified_at")
    @LastModifiedDate
    private LocalDateTime modifiedAt;
}
