package com.blossombuds.dto;

import lombok.Data;

/** DTO for creating/returning a category. */
@Data
public class CategoryDto {
    private Long id;
    private String slug;
    private String name;
    private Boolean active;
}
