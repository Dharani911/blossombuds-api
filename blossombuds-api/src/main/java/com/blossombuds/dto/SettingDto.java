package com.blossombuds.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class SettingDto {
    @NotBlank private String key;   // e.g. "store.currency", "ui.home.heroText"
    private String value;           // arbitrary text/json
    private Boolean active;         // optional; default true on create



}
