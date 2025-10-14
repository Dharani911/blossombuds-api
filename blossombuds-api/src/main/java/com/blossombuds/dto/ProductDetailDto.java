package com.blossombuds.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Full product detail for PDP (images, options, review count). */
public class ProductDetailDto {
    private Long id;
    private String slug;
    private String name;
    private String description;
    private BigDecimal price;

    private List<ProductImageDto> images; // gallery
    // Key = option name (e.g., "Size"), value = list of values for that option.
    private Map<String, List<ProductOptionValueDto>> optionsByName;

    private long approvedReviewCount;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public List<ProductImageDto> getImages() { return images; }
    public void setImages(List<ProductImageDto> images) { this.images = images; }

    public Map<String, List<ProductOptionValueDto>> getOptionsByName() { return optionsByName; }
    public void setOptionsByName(Map<String, List<ProductOptionValueDto>> optionsByName) { this.optionsByName = optionsByName; }

    public long getApprovedReviewCount() { return approvedReviewCount; }
    public void setApprovedReviewCount(long approvedReviewCount) { this.approvedReviewCount = approvedReviewCount; }
}
