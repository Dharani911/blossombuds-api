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
@Table(name = "customers", indexes = {
        @Index(name = "idx_customers_email", columnList = "email"),
        @Index(name = "idx_customers_active", columnList = "active")
})
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE customers SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
public class Customer {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 150)                   private String name;
    @Column(length = 180, nullable = false) private String email;          // unique at DB if you added it
    @Column(length = 20)                    private String phone;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "email_verified")
    private Boolean emailVerified = Boolean.FALSE;

    // audit
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
