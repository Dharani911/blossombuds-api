package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.OffsetDateTime;

/** Immutable audit log for order lifecycle events. */
@SQLDelete(sql = "UPDATE order_events SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "order_events")
public class OrderEvent {

    /** Surrogate primary key for order events. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Owning order for this event. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Order order;

    /** Event type label (e.g., CREATED, STATUS_CHANGED, PAYMENT_CAPTURED). */
    @Column(name = "event_type", length = 60)
    private String eventType;

    /** Human-readable event note. */
    @Column(name = "note", columnDefinition = "text")
    private String note;

    /** Audit: created by whom. */
    @Column(name = "created_by", length = 120)
    private String createdBy;

    /** Audit: when created. */
    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
