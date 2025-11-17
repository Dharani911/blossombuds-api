package com.blossombuds.service;

import com.blossombuds.domain.CmsPage;
import com.blossombuds.domain.CmsPageRevision;
import com.blossombuds.dto.CmsPageDto;
import com.blossombuds.repository.CmsPageRepository;
import com.blossombuds.repository.CmsPageRevisionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.OffsetDateTime;
import java.util.List;

/** CMS service for managing pages and their immutable revisions. */
@Slf4j
@Service
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CmsService {

    private final CmsPageRepository pageRepo;
    private final CmsPageRevisionRepository revRepo;

    /** Creates a page and its first revision (#1). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CmsPage create(CmsPageDto dto, String actor) {
        if (dto == null) throw new IllegalArgumentException("CmsPageDto is required");
        String slug = safeTrim(dto.getSlug());
        String title = safeTrim(dto.getTitle());
        String content = dto.getContent(); // content can be blank, but not null in DB if you prefer

        if (isBlank(slug)) throw new IllegalArgumentException("slug is required");
        if (isBlank(title)) throw new IllegalArgumentException("title is required");

        CmsPage p = new CmsPage();
        p.setSlug(slug);
        p.setTitle(title);
        p.setContent(content);
        p.setActive(dto.getActive() == null ? Boolean.TRUE : dto.getActive());
        //p.setCreatedBy(actor);
        //p.setCreatedAt(OffsetDateTime.now());
        pageRepo.save(p);
        log.info("[CMS][CREATE] Page created with slug '{}'", slug);

        saveRevision(p, 1, actor);
        return p;
    }

    /** Updates page fields and creates a new revision if title or content changed. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CmsPage update(Long pageId, CmsPageDto dto, String actor) {
        if (pageId == null) throw new IllegalArgumentException("pageId is required");
        if (dto == null) throw new IllegalArgumentException("CmsPageDto is required");

        CmsPage p = pageRepo.findById(pageId)
                .orElseThrow(() -> new IllegalArgumentException("Page not found: " + pageId));

        boolean changed = false;

        if (dto.getTitle() != null) {
            String newTitle = safeTrim(dto.getTitle());
            if (!equalsNullSafe(newTitle, p.getTitle())) { p.setTitle(newTitle); changed = true; }
        }
        if (dto.getContent() != null) {
            String newContent = dto.getContent();
            if (!equalsNullSafe(newContent, p.getContent())) { p.setContent(newContent); changed = true; }
        }
        if (dto.getSlug() != null) {
            String newSlug = safeTrim(dto.getSlug());
            if (!equalsNullSafe(newSlug, p.getSlug())) { p.setSlug(newSlug); }
        }
        if (dto.getActive() != null) {
            p.setActive(dto.getActive());
        }

        //p.setModifiedBy(actor);
        //p.setModifiedAt(OffsetDateTime.now());

        if (changed) {
            int nextRev = revRepo.findByPageIdOrderByRevisionNumberDescIdDesc(p.getId())
                    .stream()
                    .findFirst()
                    .map(CmsPageRevision::getRevisionNumber)
                    .orElse(0) + 1;
            saveRevision(p, nextRev, actor);
            log.info("[CMS][UPDATE] Page '{}' updated. New revision: {}", p.getSlug(), nextRev);
        } else {
            log.info("[CMS][UPDATE] Page '{}' updated. No content/title change.", p.getSlug());
        }

        return p;
    }

    /** Retrieves a page by slug or throws if not found. */
    public CmsPage getBySlug(String slug) {
        String s = safeTrim(slug);
        if (isBlank(s)) throw new IllegalArgumentException("slug is required");
        return pageRepo.findBySlug(s)
                .orElseThrow(() -> new IllegalArgumentException("Page not found: " + s));
    }

    /** Lists all pages (relies on @Where(active=true) if present on entity). */
    public List<CmsPage> list() {
        return pageRepo.findAll();
    }

    /** Lists revisions for a page (newest first). */
    public List<CmsPageRevision> listRevisions(Long pageId) {
        if (pageId == null) throw new IllegalArgumentException("pageId is required");
        return revRepo.findByPageIdOrderByRevisionNumberDescIdDesc(pageId);
    }

    /** Soft-deactivates a page (keeps history intact). */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(Long pageId, String actor) {
        if (pageId == null) throw new IllegalArgumentException("pageId is required");
        CmsPage p = pageRepo.findById(pageId)
                .orElseThrow(() -> new IllegalArgumentException("Page not found: " + pageId));
        p.setActive(false);
        log.info("[CMS][DELETE] Page '{}' soft-deleted by {}", p.getSlug(), actor);
    }

    /** Persists a new immutable revision snapshot for a page. */
    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    protected void saveRevision(CmsPage p, int revNo, String actor) {
        CmsPageRevision rev = new CmsPageRevision();
        rev.setPageId(p.getId());
        rev.setSlug(p.getSlug());
        rev.setTitle(p.getTitle());
        rev.setContent(p.getContent());
        rev.setRevisionNumber(revNo);
        rev.setActive(true);
        //rev.setCreatedBy(actor);
        //rev.setCreatedAt(OffsetDateTime.now());
        revRepo.save(rev);
        log.info("[CMS][REVISION] Revision {} saved for page '{}'", revNo, p.getSlug());
    }

    // ─────────────────────────────── helpers ────────────────────────────────

    /** Returns true if the string is null or blank after trimming. */
    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    /** Trims a string, returning null if input is null. */
    private static String safeTrim(String s) {
        return s == null ? null : s.trim();
    }

    /** Null-safe equality check for strings. */
    private static boolean equalsNullSafe(String a, String b) {
        return (a == null) ? (b == null) : a.equals(b);
    }
}
