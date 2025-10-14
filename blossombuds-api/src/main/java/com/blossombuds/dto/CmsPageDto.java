package com.blossombuds.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter; import lombok.Setter;

/** Payload for creating/updating a CMS page. */
@Getter @Setter
public class CmsPageDto {
    @NotBlank private String slug;
    @NotBlank private String title;
    private String content;
    private Boolean active; // optional; defaults true on create
}
