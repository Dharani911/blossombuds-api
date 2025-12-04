package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Customer account (soft-deleted; active-only by default). */
@Getter @Setter
@Entity
@Table(
        name = "customers",
        indexes = {
                @Index(name = "idx_customers_email", columnList = "email"),
                @Index(name = "idx_customers_active", columnList = "active")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_customers_email", columnNames = {"email"}),
                @UniqueConstraint(name = "uq_customers_phone", columnNames = {"phone"}),
                @UniqueConstraint(name = "uq_customers_google_subject", columnNames = {"google_subject"})
        }
)
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE customers SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
public class Customer {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 150)
    private String name;

    // ⬇️ NOW nullable so phone/Google-only accounts are possible
    @Column(length = 320)
    private String email;

    @Column(length = 20)
    private String phone;

    // Keep or later remove if you go full password-less
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "email_verified")
    private Boolean emailVerified = Boolean.FALSE;

    // ⬇️ NEW: phone verification flag
    @Column(name = "phone_verified")
    private Boolean phoneVerified = Boolean.FALSE;

    // ⬇️ NEW: Google primary identifier (sub claim from Google ID token)
    @Column(name = "google_subject", length = 255)
    private String googleSubject;

    // ⬇️ NEW: email returned by Google (can be useful for audits / linking)
    @Column(name = "google_email", length = 320)
    private String googleEmail;

    // audit (unchanged)
    private Boolean active = Boolean.TRUE;
    @CreatedBy
    @Column(name = "created_by", length = 120)  private String createdBy;
    @CreatedDate
    @Column(name = "created_at")                private LocalDateTime createdAt;
    @LastModifiedBy
    @Column(name = "modified_by", length = 120) private String modifiedBy;
    @LastModifiedDate
    @Column(name = "modified_at")               private LocalDateTime modifiedAt;
}
