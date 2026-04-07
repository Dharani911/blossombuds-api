package com.blossombuds.dto;

import lombok.Getter;
import lombok.Setter;

/** Request to subscribe for back-in-stock notification. */
@Getter
@Setter
public class BackInStockRequestDto {
    private Long productId;
    private String email;
}