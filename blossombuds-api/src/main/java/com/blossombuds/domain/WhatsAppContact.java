package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Data;
import java.time.OffsetDateTime;

/** External contact (expo lead, import list) who has not registered on the platform. */
@Data
@Entity
@Table(name = "whatsapp_contacts")
public class WhatsAppContact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String phone;

    private String name;

    /** Import batch tag, e.g. EXPO_JUN_2026. */
    private String source;

    @Column(nullable = false)
    private Boolean optedIn = Boolean.TRUE;

    private OffsetDateTime optedOutAt;

    /**
     * When this contact last sent a message to the business number.
     *
     * Meta throttles MARKETING templates per recipient (131049) based on whether the person has
     * interacted with the sending number. Non-null here means the contact is realistically
     * reachable by a marketing campaign; null means a send will very likely be dropped, however
     * genuine the offline consent was.
     */
    private OffsetDateTime lastInboundAt;

    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    private String createdBy;

    @Column(nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    private String modifiedBy;

    @Column(nullable = false)
    private OffsetDateTime modifiedAt = OffsetDateTime.now();
}
