package com.blossombuds.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/** Shared HTTP clients. */
@Configuration
public class HttpClientsConfig {
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
