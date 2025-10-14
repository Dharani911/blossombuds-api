package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Line item belonging to an order with quantity, pricing, and option snapshots. */
@SQLDelete(sql = "UPDATE order_items SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "order_items")
public class OrderItem {

    /** Surrogate primary key for order items. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Owning order for this line item. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Order order;

    /** Product snapshot name at time of purchase. */
    @Column(name = "product_name", length = 200)
    private String productName;

    /** Product snapshot slug (for reference). */
    @Column(name = "product_slug", length = 200)
    private String productSlug;

    /** Product ID at time of purchase (nullable if later removed). */
    @Column(name = "product_id")
    private Long productId;

    /** Quantity purchased. */
    @Column(nullable = false)
    private Integer quantity;

    /** Unit price at time of purchase. */
    @Column(name = "unit_price", precision = 12, scale = 2)
    private BigDecimal unitPrice;

    /** Line total (quantity * unit_price - line discounts). */
    @Column(name = "line_total", precision = 12, scale = 2)
    private BigDecimal lineTotal;

    /** Structured variant selection (JSONB). */
    @Column(name = "options_json", columnDefinition = "jsonb")
    private String optionsJson;

    /** Preformatted variant text for invoices/prints. */
    @Column(name = "options_text", length = 400)
    private String optionsText;

    /** Soft-visibility flag for this item. */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Username/actor who created this record. */
    @Column(name = "created_by", length = 120)
    private String createdBy;

    /** Timestamp when the record was created. */
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    /** Username/actor who last modified this record. */
    @Column(name = "modified_by", length = 120)
    private String modifiedBy;

    /** Timestamp when the record was last modified. */
    @Column(name = "modified_at")
    private OffsetDateTime modifiedAt;
}
