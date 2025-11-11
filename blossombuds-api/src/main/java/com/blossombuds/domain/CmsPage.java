package com.blossombuds.domain;

import jakarta.persistence.*;                          // <-- provides JPA @Id
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
// ❌ DO NOT import org.springframework.data.annotation.Id
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** CMS Page (soft-delete; active-only by default). */
@Getter
@Setter
@Entity
@Table(name = "cms_pages")
@EntityListeners(AuditingEntityListener.class)
@SQLDelete(sql = "UPDATE cms_pages SET active=false, modified_at=now() WHERE id=?")
@Where(clause = "active = true")
public class CmsPage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150, unique = true)
    private String slug;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(columnDefinition = "text")
    private String content;

    @Column(nullable = false)
    private Boolean active = true;

    // audit
    @CreatedBy
    @Column(length = 120)
    private String createdBy;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedBy
    @Column(length = 120)
    private String modifiedBy;

    @LastModifiedDate
    private LocalDateTime modifiedAt;
}
