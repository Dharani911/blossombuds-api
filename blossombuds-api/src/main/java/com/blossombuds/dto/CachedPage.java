package com.blossombuds.dto;

import java.io.Serializable;
import java.util.List;

/** JSON-safe cached page wrapper (avoid caching Spring Data Page/Pageable). */
public record CachedPage<T>(
        List<T> content,
        int page,
        int size,
        long totalElements
) implements Serializable { }
