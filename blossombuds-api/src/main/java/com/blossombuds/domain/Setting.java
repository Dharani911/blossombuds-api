package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.OffsetDateTime;

@Getter @Setter
@Entity
@Table(name = "settings",
        indexes = { @Index(name = "idx_settings_active", columnList = "active") })
@SQLDelete(sql = "UPDATE settings SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
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
    @Column(name = "created_by", length = 120) private String createdBy;
    @Column(name = "created_at") private OffsetDateTime createdAt;
    @Column(name = "modified_by", length = 120) private String modifiedBy;
    @Column(name = "modified_at") private OffsetDateTime modifiedAt;
}
