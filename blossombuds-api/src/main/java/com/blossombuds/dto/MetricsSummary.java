package com.blossombuds.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MetricsSummary {
    public Section orders;
    public Section revenue;
    public Shipping shipping;
    public Products products;
    public Customers customers;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Section {
        public long total;
        public long daily;
        public long weekly;
        public long monthly;
        public long yearly;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Shipping {
        public long monthly;
        public long yearly;
        public long max;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Products {
        public long total;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Customers {
        public long total;
        public long monthly;
        public long max; // peak cumulative, or just total if you prefer
    }
}
