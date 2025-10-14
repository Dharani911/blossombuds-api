package com.blossombuds.repository;

import com.blossombuds.domain.CmsPageRevision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CmsPageRevisionRepository extends JpaRepository<CmsPageRevision, Long> {
    List<CmsPageRevision> findByPageIdOrderByRevisionNumberDescIdDesc(Long pageId);
}
