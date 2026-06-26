package com.blossombuds.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
@Slf4j
@Component
@ConditionalOnProperty(name = "app.cache.redis.enabled", havingValue = "true")
public class RedisProbe {

    @Value("${spring.data.redis.url:}")
    private String redisUrl;

    @PostConstruct
    public void probe() {
        if (redisUrl == null || redisUrl.isBlank()) return;
        try {
            URI uri = URI.create(redisUrl);
            String host = uri.getHost();
            int port = uri.getPort();
            String userInfo = uri.getUserInfo();
            String password = (userInfo != null && userInfo.contains(":"))
                    ? userInfo.substring(userInfo.indexOf(':') + 1) : null;

            InetAddress[] ips = InetAddress.getAllByName(host);
            log.info("[REDIS][DNS] host={} port={} ips={}", host, port, Arrays.toString(ips));

            // TCP probe
            try (Socket s = new Socket()) {
                s.connect(new InetSocketAddress(host, port), 2000);
            }
            log.info("[REDIS][TCP][OK] {}:{}", host, port);

            // Raw Redis protocol probe: PING (no auth) then AUTH+PING
            rawPing(host, port, password);

        } catch (Exception e) {
            log.warn("[REDIS][PROBE][FAIL] url={} err={}", safe(redisUrl), e.toString());
        }
    }

    private void rawPing(String host, int port, String password) {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, port), 2000);
            s.setSoTimeout(3000);
            OutputStream out = s.getOutputStream();
            BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));

            // 1. PING without auth — expect +PONG or -NOAUTH
            out.write("*1\r\n$4\r\nPING\r\n".getBytes(StandardCharsets.UTF_8));
            out.flush();
            String pingResp = in.readLine();
            log.info("[REDIS][RAW][PING-NOAUTH] response={}", pingResp);

            // 2. If password is set, try AUTH <password> then PING
            if (password != null && !password.isBlank()) {
                String authCmd = "*2\r\n$4\r\nAUTH\r\n$" + password.length() + "\r\n" + password + "\r\n";
                out.write(authCmd.getBytes(StandardCharsets.UTF_8));
                out.flush();
                String authResp = in.readLine();
                log.info("[REDIS][RAW][AUTH] response={}", authResp);

                out.write("*1\r\n$4\r\nPING\r\n".getBytes(StandardCharsets.UTF_8));
                out.flush();
                String pingAuthResp = in.readLine();
                log.info("[REDIS][RAW][PING-AUTHED] response={}", pingAuthResp);
            }
        } catch (SocketTimeoutException e) {
            log.warn("[REDIS][RAW][TIMEOUT] No response from Redis within 3s — likely a network/proxy issue");
        } catch (Exception e) {
            log.warn("[REDIS][RAW][FAIL] {}: {}", e.getClass().getSimpleName(), e.getMessage());
        }
    }

    private String safe(String u) {
        return u == null ? "" : u.replaceAll("://([^:]+):([^@]+)@", "://$1:***@");
    }
}
