package com.blossombuds.dto;

import lombok.Data;

import java.util.List;

@Data
public class OrderUpdateRequest {
    private OrderDto order;                 // for mutable fields; id required
    private List<OrderItemDto> items;       // optional: replace items when flag true
    private Boolean replaceItems;           // default true when null
}