package com.blossombuds.domain;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Line item belonging to an order with quantity, pricing, and option snapshots. */
@SQLDelete(sql = "UPDATE order_items SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@Entity @Table(name = "order_items")
public class OrderItem {

    /** Surrogate primary key for order items. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Owning order for this line item. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Order order;

    /** Product snapshot name at time of purchase. */
    @Column(name = "product_name", length = 200)
    private String productName;


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
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "options_json", columnDefinition = "jsonb")
    private JsonNode optionsJson;

    /** Preformatted variant text for invoices/prints. */
    @Column(name = "options_text", length = 400)
    private String optionsText;

    /** Soft-visibility flag for this item. */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    /** Username/actor who created this record. */
    @Column(name = "created_by", length = 120)
    @CreatedBy
    private String createdBy;

    @Column(name = "created_at")
    @CreatedDate
    private LocalDateTime createdAt;

    @Column(name = "modified_by", length = 120)
    @LastModifiedBy
    private String modifiedBy;

    /** Timestamp when the record was last modified. */
    @Column(name = "modified_at")
    @LastModifiedDate
    private LocalDateTime modifiedAt;
}
