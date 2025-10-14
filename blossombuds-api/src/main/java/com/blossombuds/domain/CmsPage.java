package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;
import org.hibernate.annotations.SQLDelete; import org.hibernate.annotations.Where;

import java.time.OffsetDateTime;

/** CMS Page (soft-delete; active-only by default). */
@Getter @Setter
@Entity @Table(name = "cms_pages")
@SQLDelete(sql = "UPDATE cms_pages SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
public class CmsPage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 150) private String slug;     // unique in DB
    @Column(nullable = false, length = 150) private String title;
    @Column(columnDefinition = "text") private String content;       // current published content
    private Boolean active = true;

    // audit
    @Column(length=120) private String createdBy;
    private OffsetDateTime createdAt;
    @Column(length=120) private String modifiedBy;
    private OffsetDateTime modifiedAt;
}
