package com.blossombuds.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * Per-state delivery partner allowlist.
 * If a state has entries here, only those partners appear at checkout for that state.
 * States with no entries show all active+visible partners.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "state_partner_allowlist")
public class StatePartnerAllowlist {

    @EmbeddedId
    private StatePartnerAllowlistId id;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Embeddable
    public static class StatePartnerAllowlistId implements Serializable {
        @Column(name = "state_id", nullable = false)
        private Long stateId;

        @Column(name = "delivery_partner_id", nullable = false)
        private Long deliveryPartnerId;
    }
}
