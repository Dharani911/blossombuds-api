package com.blossombuds.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.*;
import java.util.Arrays;

@Slf4j
@Component
public class RedisProbe {

    @Value("${spring.data.redis.url:}")
    private String redisUrl;

    @PostConstruct
    public void probe() {
        try {
            URI uri = URI.create(redisUrl);
            String host = uri.getHost();
            int port = uri.getPort();

            InetAddress[] ips = InetAddress.getAllByName(host);
            log.info("[REDIS][DNS] host={} port={} ips={}", host, port, Arrays.toString(ips));

            try (Socket s = new Socket()) {
                s.connect(new InetSocketAddress(host, port), 1500);
            }
            log.info("[REDIS][TCP][OK] {}:{}", host, port);

        } catch (Exception e) {
            log.warn("[REDIS][PROBE][FAIL] url={} err={}",
                    safe(redisUrl), e.toString());
        }
    }

    private String safe(String u) {
        return u == null ? "" : u.replaceAll("://([^:]+):([^@]+)@", "://$1:***@");
    }
}
