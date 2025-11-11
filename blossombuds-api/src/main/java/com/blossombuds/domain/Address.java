package com.blossombuds.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

/** Postal address belonging to a customer. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@ToString @EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(name = "addresses")
@SQLDelete(sql = "UPDATE addresses SET active = false, modified_at = now() WHERE id = ?")
@Where(clause = "active = true")
public class Address {

    /** Surrogate primary key for addresses. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @JsonIgnore
    /** Owning customer. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_address_customer"))
    @ToString.Exclude
    private Customer customer;

    /** Recipient name for this address. */
    @Column(name = "name", length = 120)
    private String name;

    /** Phone number for this address. */
    @Column(name = "phone", length = 20)
    private String phone;

    /** Address line 1. */
    @Column(name = "line1", length = 200)
    private String line1;

    /** Address line 2. */
    @Column(name = "line2", length = 200)
    private String line2;

    /** District / City (navigation via FK addresses.district_id). */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "district_id",
            foreignKey = @ForeignKey(name = "fk_address_district"))
    @ToString.Exclude
    private District district;

    /** State / Region (navigation via FK addresses.state_id). */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "state_id",
            foreignKey = @ForeignKey(name = "fk_address_state"))
    @ToString.Exclude
    private State state;

    /** Country (navigation via FK addresses.country_id). */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "country_id",
            foreignKey = @ForeignKey(name = "fk_address_country"))
    @ToString.Exclude
    private Country country;

    /** Postal code. */
    @Column(name = "pincode", length = 10)
    private String pincode;

    /** Whether this is the customer's default address. */
    @Column(name = "is_default", nullable = false)
    private Boolean isDefault = Boolean.FALSE;

    /** Soft-visibility/activation flag. */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    // --- audit ---
    @CreatedBy
    @Column(name = "created_by", length = 120)
    private String createdBy;

    @CreatedDate
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @LastModifiedBy
    @Column(name = "modified_by", length = 120)
    private String modifiedBy;

    @LastModifiedDate
    @Column(name = "modified_at")
    private LocalDateTime modifiedAt;
}
