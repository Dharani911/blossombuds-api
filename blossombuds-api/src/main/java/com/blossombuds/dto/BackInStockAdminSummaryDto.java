package com.blossombuds.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Admin summary of active back-in-stock requests for out-of-stock products. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BackInStockAdminSummaryDto {
    private Long productId;
    private String productName;
    private Long activeRequestCount;
    private LocalDateTime waitingSince;
}