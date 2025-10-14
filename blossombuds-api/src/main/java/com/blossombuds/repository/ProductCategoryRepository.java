package com.blossombuds.repository;

import com.blossombuds.domain.ProductCategory;
import com.blossombuds.domain.ProductCategory.PK;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/** Repository for reading/writing product-category mappings. */
public interface ProductCategoryRepository extends JpaRepository<ProductCategory, PK> {
    /** Lists all category links for a product. */
    List<ProductCategory> findByProduct_Id(Long productId);

    /** Lists all product links for a category. */
    List<ProductCategory> findByCategory_Id(Long categoryId);

    /** Checks if a product is already linked to a category. */
    boolean existsById(PK id);

    @Modifying
    @Query(value = """
    UPDATE product_categories
       SET active = false, modified_at = now()
     WHERE product_id = :pid AND category_id = :cid
  """, nativeQuery = true)
    int softUnlink(@Param("pid") Long productId, @Param("cid") Long categoryId);
    @Query(value = """
        select * 
        from product_categories 
        where product_id = :productId and category_id = :categoryId 
        limit 1
    """, nativeQuery = true)
    Optional<ProductCategory> findAnyLink(Long productId, Long categoryId);
}

