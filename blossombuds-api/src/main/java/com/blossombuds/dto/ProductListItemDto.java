package com.blossombuds.dto;

import java.math.BigDecimal;

/** Product summary for listing/search pages. */
public class ProductListItemDto {
    private Long id;
    private String slug;
    private String name;
    private BigDecimal price;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
}
