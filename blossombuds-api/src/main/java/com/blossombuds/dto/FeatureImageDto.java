// src/main/java/com/blossombuds/dto/FeatureImageDto.java
package com.blossombuds.dto;

import lombok.Data;

@Data
public class FeatureImageDto {
    private String key;       // r2 object key: ui/feature_tiles/....
    private String url;       // signed GET url (short-lived)
    private String altText;   // optional (stored in settings)
    private Integer sortOrder;
}
