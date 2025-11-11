package com.blossombuds.dto;

import lombok.Data;

import java.util.List;

@Data
public class OrderCreateRequest {
    private OrderDto order;                 // required
    private List<OrderItemDto> items;       // optional
}