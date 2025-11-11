package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;
import org.hibernate.annotations.SQLDelete; import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Immutable snapshots of CMS page content. */
@Getter @Setter
@Entity @Table(name = "cms_page_revisions")
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE cms_page_revisions SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
public class CmsPageRevision {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;

    @Column(name="page_id", nullable = false) private Long pageId;
    @Column(nullable = false, length = 150) private String slug;
    @Column(nullable = false, length = 150) private String title;
    @Column(columnDefinition = "text") private String content;

    private Integer revisionNumber; // monotonic per page
    private Boolean active = true;

    // audit
    @CreatedBy
    @Column(length=120) private String createdBy;
    @CreatedDate
    private LocalDateTime createdAt;
    @LastModifiedBy
    @Column(length=120) private String modifiedBy;
    @LastModifiedDate
    private LocalDateTime modifiedAt;
}
