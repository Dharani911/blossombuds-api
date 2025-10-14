package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;

import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.OffsetDateTime;

/** Back-office admin account for managing the store. */
@SQLDelete(sql = "UPDATE admins SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "admins", uniqueConstraints = {
        @UniqueConstraint(name = "uk_admins_username", columnNames = "username"),
        @UniqueConstraint(name = "uk_admins_email", columnNames = "email")
})
public class Admin {

    /** Surrogate primary key for admins. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique login handle. */
    @Column(length = 60, nullable = false)
    private String name;

    /** Unique email address. */
    @Column(length = 160, nullable = false)
    private String email;

    /** BCrypt/Argon2 hash (never store raw passwords). */
    @Column(name = "password_hash", length = 255, nullable = false)
    private String passwordHash;




    /** Soft-visibility/activation flag. */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Audit: created by whom. */
    @Column(name = "created_by", length = 120)
    private String createdBy;

    /** Audit: when created. */
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    /** Audit: last modifier. */
    @Column(name = "modified_by", length = 120)
    private String modifiedBy;

    /** Audit: when modified. */
    @Column(name = "modified_at")
    private OffsetDateTime modifiedAt;
}
