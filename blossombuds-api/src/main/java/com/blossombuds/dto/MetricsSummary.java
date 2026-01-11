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

        private long prevDaily;
        private long prevWeekly;
        private long prevMonthly;
        private long prevYearly;
    }

    @Getter @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Shipping {
        private long total;
        private long daily;
        private long weekly;
        private long monthly;
        private long yearly;

        private long prevDaily;
        private long prevWeekly;
        private long prevMonthly;
        private long prevYearly;

        private long max;
    }


    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Products {
        public long total;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Customers {
        private long total;


        private long daily;
        private long weekly;
        private long monthly;
        private long yearly;

        private long prevDaily;
        private long prevWeekly;
        private long prevMonthly;
        private long prevYearly;

        private long max;
    }
}
