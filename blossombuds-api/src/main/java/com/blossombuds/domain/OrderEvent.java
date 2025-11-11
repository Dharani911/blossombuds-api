package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Map;

@SQLDelete(sql = "UPDATE order_events SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@Entity @Table(name = "order_events") // add schema if you use it
public class OrderEvent {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Order order;

    @Column(name = "event_type", length = 60, nullable = false)
    private String eventType;

    /** Store JSONB in DB; we project a simple { "note": "..." } shape by default. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "details", columnDefinition = "jsonb")
    private Map<String, Object> details;

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

    @Column(name = "active")
    private Boolean active = Boolean.TRUE;

    // Convenience: keep old getter/setter semantics so service code need not change
    @Transient
    public String getNote() {
        return details == null ? null : (String) details.get("note");
    }

    public void setNote(String note) {
        // if you later want to store richer payloads, extend this map
        this.details = Map.of("note", note);
    }
}
