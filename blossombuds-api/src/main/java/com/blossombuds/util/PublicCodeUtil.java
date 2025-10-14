package com.blossombuds.util;

/** Utilities for public order codes (stored as YYNNNN, shown/accepted as BBYYNNNN). */
public final class PublicCodeUtil {
    private PublicCodeUtil() {}

    /** Render YYNNNN as BBYYNNNN for emails/UI. */
    public static String withPrefix(String yyNnnn) {
        if (yyNnnn == null) return null;
        return yyNnnn.startsWith("BB") ? yyNnnn : "BB" + yyNnnn;
    }

    /** Accept BBYYNNNN or YYNNNN, return just YYNNNN for DB lookups. */
    public static String stripPrefix(String any) {
        if (any == null) return null;
        return any.toUpperCase().startsWith("BB") ? any.substring(2) : any;
    }
}
