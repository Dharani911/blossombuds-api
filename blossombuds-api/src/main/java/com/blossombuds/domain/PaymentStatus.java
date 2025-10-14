package com.blossombuds.domain;


import com.blossombuds.db.PgEnum;

/** Lifecycle states of a payment. */
@PgEnum("payment_status_enum")
public enum PaymentStatus {
    CREATED, AUTHORIZED, CAPTURED, FAILED, REFUNDED
}
