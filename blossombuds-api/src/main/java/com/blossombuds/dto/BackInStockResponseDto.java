package com.blossombuds.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** Response for back-in-stock subscription action. */
@Getter
@AllArgsConstructor
public class BackInStockResponseDto {
    private boolean success;
    private String message;
}