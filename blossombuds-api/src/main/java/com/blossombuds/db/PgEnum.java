package com.blossombuds.db;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.lang.annotation.ElementType;

/** Marks a Java enum with its PostgreSQL enum type name (e.g., "order_status_enum"). */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface PgEnum {
    /** PostgreSQL enum type name, exactly as created in the DB. */
    String value();
}
