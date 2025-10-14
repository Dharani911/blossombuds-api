package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.OffsetDateTime;

/** Partner/courier through which orders are dispatched and tracked. */
@SQLDelete(sql = "UPDATE delivery_partners SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "delivery_partners")
public class DeliveryPartner {

    /** Surrogate primary key for delivery partners. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique slug/key (e.g., bluedart, dtdc). */
    @Column(name = "slug", length = 60, unique = true)
    private String slug;

    /** Display name (e.g., BlueDart). */
    @Column(name = "name", length = 120)
    private String name;

    /** URL template for tracking (e.g., https://track.example.com/{tracking_number}). */
    @Column(name = "tracking_url_template", columnDefinition = "text")
    private String trackingUrlTemplate;

    /** Support contact email, if any. */
    @Column(name = "support_email", length = 120)
    private String supportEmail;

    /** Support phone, if any. */
    @Column(name = "support_phone", length = 40)
    private String supportPhone;

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
