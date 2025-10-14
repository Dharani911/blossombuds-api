package com.blossombuds.security;



import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.servlet.MultipartConfigFactory;
import org.springframework.util.unit.DataSize;

import jakarta.servlet.MultipartConfigElement;

@Configuration
public class MultipartConfig {

    @Bean
    public MultipartConfigElement multipartConfigElement() {
        MultipartConfigFactory factory = new MultipartConfigFactory();
        // Pick limits you’re comfortable with — these are just examples
        factory.setMaxFileSize(DataSize.ofMegabytes(15));    // per file
        factory.setMaxRequestSize(DataSize.ofMegabytes(15)); // total per request
        return factory.createMultipartConfig();
    }
}
