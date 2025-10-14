package com.blossombuds.db;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;

/** Scans your domain package for @PgEnum enums and registers them at startup. */
@Configuration
public class PgEnumAutoRegistrar {

    /** Scans package "com.blossombuds.domain" for @PgEnum enums and registers them. */
    @PostConstruct
    public void registerEnums() {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(PgEnum.class));

        String basePackage = "com.blossombuds.domain"; // <-- change if your enums are elsewhere
        scanner.findCandidateComponents(basePackage).forEach(bd -> {
            try {
                Class<?> clazz = Class.forName(bd.getBeanClassName());
                if (clazz.isEnum()) {
                    PgEnum ann = clazz.getAnnotation(PgEnum.class);
                    @SuppressWarnings("unchecked")
                    Class<? extends Enum<?>> enumClass = (Class<? extends Enum<?>>) clazz;
                    PgEnumRegistry.register((Class) enumClass, ann.value());
                }
            } catch (ClassNotFoundException e) {
                throw new IllegalStateException("Failed to load enum class " + bd.getBeanClassName(), e);
            }
        });
    }
}
