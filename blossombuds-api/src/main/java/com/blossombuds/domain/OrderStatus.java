package com.blossombuds.domain;

import com.blossombuds.db.PgEnum;
import jakarta.persistence.Enumerated;

/** Lifecycle states of an order. */

@PgEnum("order_status_enum")
public enum OrderStatus {
    ORDERED, DISPATCHED, DELIVERED, CANCELLED, REFUNDED, RETURNED_REFUNDED
}
