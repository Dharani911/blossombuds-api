package com.blossombuds.web;

import com.blossombuds.domain.CmsPage;
import com.blossombuds.domain.CmsPageRevision;
import com.blossombuds.dto.CmsPageDto;
import com.blossombuds.service.CmsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** HTTP endpoints for CMS pages & revisions. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/cms")
@Validated
public class CmsController {

    private final CmsService cms;

    /** Create a CMS page (also creates revision #1). */
    @PostMapping("/pages")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public CmsPage create(@Valid @RequestBody CmsPageDto dto,
                          @RequestHeader(name = "X-Actor", required = false) String actor) {
        return cms.create(dto, actor != null ? actor : "system");
    }

    /** Update a CMS page; auto-creates a new revision if content changed. */
    @PatchMapping("/pages/{pageId}")
    @PreAuthorize("hasRole('ADMIN')")
    public CmsPage update(@PathVariable Long pageId,
                          @RequestBody CmsPageDto dto,
                          @RequestHeader(name = "X-Actor", required = false) String actor) {
        return cms.update(pageId, dto, actor != null ? actor : "system");
    }

    /** Get a page by slug (active-only, public). */
    @GetMapping("/pages/by-slug/{slug}")
    public CmsPage getBySlug(@PathVariable String slug) {
        return cms.getBySlug(slug);
    }

    /** List all CMS pages (active-only, public). */
    @GetMapping("/pages")
    public List<CmsPage> list() {
        return cms.list();
    }

    /** List revisions for a page (newest first, admin-only). */
    @GetMapping("/pages/{pageId}/revisions")
    @PreAuthorize("hasRole('ADMIN')")
    public List<CmsPageRevision> revisions(@PathVariable Long pageId) {
        return cms.listRevisions(pageId);
    }

    /** Soft delete a page (admin-only). */
    @DeleteMapping("/pages/{pageId}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long pageId,
                       @RequestHeader(name = "X-Actor", required = false) String actor) {
        cms.delete(pageId, actor != null ? actor : "system");
    }
}
