package com.blossombuds.repository;

import com.blossombuds.domain.Product;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Optional;

/** Repository for reading/writing products. */
public interface ProductRepository extends JpaRepository<Product, Long> {
    /** Finds a product by its unique slug. */
    Optional<Product> findBySlug(String slug);

    @Query(value = "SELECT CASE WHEN count(*) > 0 THEN true ELSE false END FROM products p WHERE p.slug = :slug", nativeQuery = true)
    boolean existsBySlugNative(@Param("slug") String slug);

    @Query("""
  select p
  from Product p
  where p.active = true
    and exists (
      select 1
      from ProductCategory pc
      where pc.product = p
        and pc.category.id = :categoryId
        and pc.active = true
    )
""")
    Page<Product> findActiveByCategoryId(@Param("categoryId") Long categoryId, Pageable pageable);

    @Query("""
        select p from Product p
        where p.active = true
          and (
               lower(p.name) like lower(concat('%', :q, '%'))
            or lower(coalesce(p.description, '')) like lower(concat('%', :q, '%'))
            or exists (
                 select 1 from ProductOptionValue v
                 where v.active=true and v.option.product.id = p.id
                   and lower(v.valueLabel) like lower(concat('%', :q, '%'))
            )
            or exists (
                 select 1 from ProductCategory pc
                    join pc.category c
                 where pc.active=true and c.active=true
                   and pc.product.id = p.id
                   and lower(c.name) like lower(concat('%', :q, '%'))
            )
          )
          and (:categoryId is null or exists (
                 select 1 from ProductCategory x
                 where x.active=true and x.product.id = p.id and x.category.id = :categoryId
          ))
          and (:priceMin is null or p.price >= :priceMin)
          and (:priceMax is null or p.price <= :priceMax)
        order by p.name asc
        """)
    Page<Product> searchProducts(@Param("q") String q,
                                 @Param("categoryId") Long categoryId,
                                 @Param("priceMin") BigDecimal priceMin,
                                 @Param("priceMax") BigDecimal priceMax,
                                 Pageable pageable);
    Page<Product> findByFeaturedTrue(Pageable pageable);

    // If you gate by visible flag too:
    Page<Product> findByFeaturedTrueAndVisibleTrue(Pageable pageable);

}
