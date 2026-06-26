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

    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    private String createdBy;

    @Column(nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    private String modifiedBy;

    @Column(nullable = false)
    private OffsetDateTime modifiedAt = OffsetDateTime.now();
}
