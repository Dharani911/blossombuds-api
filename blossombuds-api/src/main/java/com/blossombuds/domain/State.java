package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;
import org.hibernate.annotations.SQLDelete; import org.hibernate.annotations.Where;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@Getter @Setter
@Entity
@Table(name = "states", indexes = {
        @Index(name = "idx_states_country", columnList = "country_id"),
        @Index(name = "idx_states_name", columnList = "name")
})
@SQLDelete(sql = "UPDATE states SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
public class State {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "country_id", nullable = false)
    private Long countryId;

    @Column(length = 120, nullable = false)
    private String name;

    // audit / soft-delete
    private Boolean active = Boolean.TRUE;
    @Column(name = "created_by", length = 120)  private String createdBy;
    @Column(name = "created_at")                private LocalDateTime createdAt;
    @Column(name = "modified_by", length = 120) private String modifiedBy;
    @Column(name = "modified_at")               private LocalDateTime modifiedAt;
}
