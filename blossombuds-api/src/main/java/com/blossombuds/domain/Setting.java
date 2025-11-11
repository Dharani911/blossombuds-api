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

@Getter @Setter
@Entity
@Table(name = "settings",
        indexes = { @Index(name = "idx_settings_active", columnList = "active") })
@SQLDelete(sql = "UPDATE settings SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
@EntityListeners(AuditingEntityListener.class)
public class Setting {


    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "key", nullable = false, length = 120)
    private String key;

    @Column(name = "value", columnDefinition = "text")
    private String value;

    @Column(name = "active")
    private Boolean active = Boolean.TRUE;

    // audit
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
