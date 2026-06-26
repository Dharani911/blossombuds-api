package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/** A named group of states used as a shipping fee scope (e.g., "South India", "North India"). */
@Getter
@Setter
@Entity
@Table(name = "delivery_regions")
@SQLDelete(sql = "UPDATE delivery_regions SET active = false, modified_at = NOW() WHERE id = ?")
@Where(clause = "active = true")
public class DeliveryRegion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Column(name = "active", nullable = false)
    private Boolean active = Boolean.TRUE;

    /** IDs of states belonging to this region. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "delivery_region_states",
            joinColumns = @JoinColumn(name = "region_id")
    )
    @Column(name = "state_id")
    private Set<Long> stateIds = new HashSet<>();

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "modified_at")
    private LocalDateTime modifiedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        modifiedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        modifiedAt = LocalDateTime.now();
    }
}
