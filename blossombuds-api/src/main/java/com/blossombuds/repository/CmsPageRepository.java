package com.blossombuds.repository;

import com.blossombuds.domain.CmsPage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CmsPageRepository extends JpaRepository<CmsPage, Long> {
    Optional<CmsPage> findBySlug(String slug); // active-only by @Where
}
