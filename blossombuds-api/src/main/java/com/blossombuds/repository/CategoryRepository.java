package com.blossombuds.repository;

import com.blossombuds.domain.Category;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/** Repository for reading/writing categories. */
public interface CategoryRepository extends JpaRepository<Category, Long> {
    /** Finds a category by its unique slug. */
    Optional<Category> findBySlug(String slug);

    /** Lists subcategories for a given parent id (null for roots if needed). */
    List<Category> findByParent_Id(Long parentId);

    /**
     * Checks slug uniqueness across ALL rows (active and soft-deleted).
     * Must be a native query to bypass Hibernate's @Where(active=true) filter,
     * otherwise soft-deleted rows are invisible and cause a DB unique constraint
     * violation at INSERT time.
     */
    @Query(value = "SELECT COUNT(1) FROM categories WHERE slug = :slug", nativeQuery = true)
    int countBySlugAllRows(@Param("slug") String slug);
    /** Categories linked to a product (active on both link and category). */
    @Query("""
           select c
           from ProductCategory pc
           join pc.category c
           where pc.product.id = :productId
             and pc.active = true
             and c.active = true
           order by c.id
           """)
    List<Category> findActiveByProductId(Long productId);

    Page<Category> findByActiveTrueAndNameContainingIgnoreCase(String q, Pageable pageable);
    boolean existsBySlug(String slug);
    List<Category> findAllByOrderBySortOrderAscNameAscIdAsc();

    List<Category> findByParent_IdOrderBySortOrderAscNameAscIdAsc(Long parentId);

}
