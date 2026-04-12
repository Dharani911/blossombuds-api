package com.blossombuds.dto;

import lombok.Data;

@Data
public class CartSuggestionReorderDto {
    private Long productId;
    private Integer sortOrder;
}