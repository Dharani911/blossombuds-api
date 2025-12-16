package com.blossombuds.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.io.Serializable;
import java.util.List;

/**
 * Cache-safe replacement for Spring Page<T> to avoid PageImpl serialization issues in Redis.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CachedPage<T> implements Serializable {

    /** Page items. */
    private List<T> content;

    /** Current page index (0-based). */
    private int page;

    /** Requested page size. */
    private int size;

    /** Total number of elements across all pages. */
    private long totalElements;

    /** Total number of pages. */
    private int totalPages;

    /** Number of elements in this page. */
    private int numberOfElements;

    /** Whether this is the first page. */
    private boolean first;

    /** Whether this is the last page. */
    private boolean last;

    /** Convenience helper to build CachedPage from Spring Page. */
    public static <T> CachedPage<T> from(Page<T> pg) {
        if (pg == null) throw new IllegalArgumentException("Page is required");

        return new CachedPage<>(
                pg.getContent(),
                pg.getNumber(),
                pg.getSize(),
                pg.getTotalElements(),
                pg.getTotalPages(),
                pg.getNumberOfElements(),
                pg.isFirst(),
                pg.isLast()
        );
    }
}
