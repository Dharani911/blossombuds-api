package com.blossombuds.db;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Registry mapping PostgreSQL enum type names to Java enum classes. */
public final class PgEnumRegistry {
    private static final Map<String, Class<? extends Enum<?>>> TYPE_TO_ENUM = new ConcurrentHashMap<>();

    /** Registers a mapping between a Java enum class and a PostgreSQL enum type name. */
    public static <E extends Enum<E>> void register(Class<E> enumClass, String pgType) {
        TYPE_TO_ENUM.putIfAbsent(pgType, enumClass);
    }

    /** Looks up the Java enum class by PostgreSQL enum type name. */
    public static Class<? extends Enum<?>> getEnumClass(String pgType) {
        return TYPE_TO_ENUM.get(pgType);
    }

    private PgEnumRegistry() {} // utility
}
