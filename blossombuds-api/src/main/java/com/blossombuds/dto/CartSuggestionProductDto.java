package com.blossombuds.dto;


import lombok.Data;

@Data
public class CartSuggestionProductDto {
    private Long id;
    private Long productId;
    private String productName;
    private Integer sortOrder;
    private Boolean active;
}