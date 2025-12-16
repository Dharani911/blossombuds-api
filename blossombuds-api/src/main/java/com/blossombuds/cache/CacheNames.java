package com.blossombuds.cache;

/** Central cache name registry. */
public final class CacheNames {
    private CacheNames() {}

    /** Cache for product lists by category + paging params. */
    public static final String PRODUCTS_BY_CATEGORY = "catalog.products.byCategory";

    /** Cache for product detail by id. */
    public static final String PRODUCT_BY_ID = "catalog.productById";

    /** Cache for order lite by public code. */
    public static final String ORDER_LITE_BY_CODE = "orders.orderLiteByCode";
}
