package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;
import org.hibernate.annotations.SQLDelete; import org.hibernate.annotations.Where;

import java.time.OffsetDateTime;

@Getter @Setter
@Entity
@Table(name = "countries", indexes = {
        @Index(name = "idx_countries_name", columnList = "name")
})
@SQLDelete(sql = "UPDATE countries SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
public class Country {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 120, nullable = false, unique = true)
    private String name;

    // audit / soft-delete
    private Boolean active = Boolean.TRUE;
    @Column(name = "created_by", length = 120)  private String createdBy;
    @Column(name = "created_at")                private OffsetDateTime createdAt;
    @Column(name = "modified_by", length = 120) private String modifiedBy;
    @Column(name = "modified_at")               private OffsetDateTime modifiedAt;
}
