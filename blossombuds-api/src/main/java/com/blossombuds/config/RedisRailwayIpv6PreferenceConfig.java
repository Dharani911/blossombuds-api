package com.blossombuds.config;

import io.lettuce.core.resource.ClientResources;
import io.lettuce.core.resource.DefaultClientResources;
import io.lettuce.core.resource.DnsResolver;
import io.lettuce.core.resource.DnsResolvers;
import org.springframework.boot.autoconfigure.data.redis.LettuceClientConfigurationBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;

/** Prefer IPv6 only for Railway internal DNS, without impacting public traffic like Cloudflare R2. */
@Configuration
public class RedisRailwayIpv6PreferenceConfig {

    @Bean(destroyMethod = "shutdown")
    public ClientResources lettuceClientResources() {
        DnsResolver delegate = DnsResolvers.JVM_DEFAULT;

        DnsResolver railwayIpv6First = new DnsResolver() {
            @Override
            public InetAddress[] resolve(String host) throws UnknownHostException {
                InetAddress[] addrs = delegate.resolve(host);

                if (host != null && host.endsWith(".railway.internal") && addrs != null && addrs.length > 1) {
                    Arrays.sort(addrs, (a, b) -> {
                        boolean a6 = a instanceof Inet6Address;
                        boolean b6 = b instanceof Inet6Address;
                        return Boolean.compare(!a6, !b6); // IPv6 first
                    });
                }
                return addrs;
            }
        };

        return DefaultClientResources.builder()
                .dnsResolver(railwayIpv6First)
                .build();
    }

    @Bean
    public LettuceClientConfigurationBuilderCustomizer lettuceCustomizer(ClientResources resources) {
        return builder -> builder.clientResources(resources);
    }
}
