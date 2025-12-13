// src/main/java/com/blossombuds/dto/FeatureImageDto.java
package com.blossombuds.dto;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

@Data
public class FeatureImageDto implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    private String key;       // r2 object key: ui/feature_tiles/....
    private String url;       // signed GET url (short-lived)
    private String altText;   // optional (stored in settings)
    private Integer sortOrder;
}
