package com.blossombuds.repository;

import com.blossombuds.domain.Category;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

/** Repository for reading/writing categories. */
public interface CategoryRepository extends JpaRepository<Category, Long> {
    /** Finds a category by its unique slug. */
    Optional<Category> findBySlug(String slug);

    /** Lists subcategories for a given parent id (null for roots if needed). */
    List<Category> findByParent_Id(Long parentId);
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


}
