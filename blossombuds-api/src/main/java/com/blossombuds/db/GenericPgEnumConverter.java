package com.blossombuds.db;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.postgresql.util.PGobject;

/** Generic converter that maps any @PgEnum-annotated Java enum to a PostgreSQL enum column. */
@Converter(autoApply = false)
public class GenericPgEnumConverter implements AttributeConverter<Enum<?>, PGobject> {

    /** Converts a Java enum (annotated with @PgEnum) into a PGobject of that PG enum type. */
    @Override
    public PGobject convertToDatabaseColumn(Enum<?> attribute) {
        if (attribute == null) return null;
        String pgType = resolvePgType(attribute.getDeclaringClass());
        try {
            PGobject po = new PGobject();
            po.setType(pgType);
            po.setValue(attribute.name());
            return po;
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to convert enum " + attribute + " to PGobject", e);
        }
    }

    /** Converts a PGobject back into the correct Java enum constant using the registry. */
    @Override
    @SuppressWarnings({ "rawtypes", "unchecked" })
    public Enum<?> convertToEntityAttribute(PGobject dbData) {
        if (dbData == null || dbData.getValue() == null) return null;
        Class<? extends Enum> enumClass = PgEnumRegistry.getEnumClass(dbData.getType());
        if (enumClass == null) {
            throw new IllegalStateException("No enum class registered for PostgreSQL type: " + dbData.getType());
        }
        return Enum.valueOf(enumClass, dbData.getValue());
    }

    /** Resolves the PG enum type from @PgEnum and registers it for read-path lookups. */
    private static String resolvePgType(Class<?> enumClass) {
        PgEnum ann = enumClass.getAnnotation(PgEnum.class);
        if (ann == null) {
            throw new IllegalStateException("Enum " + enumClass.getName() + " must be annotated with @PgEnum(\"<pg_type>\")");
        }
        PgEnumRegistry.register(enumClass.asSubclass(Enum.class), ann.value());
        return ann.value();
    }
}
