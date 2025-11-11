package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Partner/courier through which orders are dispatched and tracked. */
@SQLDelete(sql = "UPDATE delivery_partners SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@Entity
@Table(
        name = "delivery_partners",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_dpartners_code", columnNames = "code"),
                @UniqueConstraint(name = "uk_dpartners_name", columnNames = "name")
        }
)
public class DeliveryPartner {

    /** Surrogate primary key for delivery partners. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Display name (e.g., "Blue Dart"). */
    @Column(name = "name", length = 100, nullable = true)
    private String name;

    /** Unique partner code/key (e.g., "BLUEDART", "DTDC"). */
    @Column(name = "code", length = 40, nullable = true)
    private String code;

    /** URL template for tracking, e.g. https://track.example.com/{trackingNumber} */
    @Column(name = "tracking_url_template", columnDefinition = "text")
    private String trackingUrlTemplate;

    /** Soft-visibility/activation flag. */
    @Column(name = "active", nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Audit: created by whom. */
    @Column(name = "created_by", length = 120)
    @CreatedBy
    private String createdBy;

    /** Audit: when created. */
    @Column(name = "created_at")
    @CreatedDate
    private LocalDateTime createdAt;

    /** Audit: last modifier. */
    @Column(name = "modified_by", length = 120)
    @LastModifiedBy
    private String modifiedBy;

    /** Audit: when modified. */
    @Column(name = "modified_at")
    @LastModifiedDate
    private LocalDateTime modifiedAt;
}
