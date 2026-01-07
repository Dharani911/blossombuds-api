package com.blossombuds.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.SerializationException;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Map;

/** Redis cache configuration for Spring Cache with safe JSON serialization and cache-versioning. */
@Configuration
@EnableCaching
@Slf4j
public class RedisConfig implements CachingConfigurer {
    @Value("${spring.data.redis.url:}")
    private String redisUrl;

    @PostConstruct
    public void logRedisUrl() {
        String safe = redisUrl == null ? "" : redisUrl.replaceAll("://([^:]+):([^@]+)@", "://$1:***@");
        log.info("[REDIS][CONFIG] url={}", safe);
    }
    /** Builds a RedisCacheManager with JSON values and string keys. */
    @Primary
    @Bean
    public RedisCacheManager cacheManager(
            RedisConnectionFactory connectionFactory,
            @Value("${app.cache.default-ttl:PT6H}") Duration defaultTtl
    ) {
        BasicPolymorphicTypeValidator ptv = BasicPolymorphicTypeValidator.builder()
                .allowIfSubType("com.blossombuds.dto")
                .allowIfSubType("org.springframework.data")
                .allowIfSubType("java.math")
                .allowIfSubType("java.util")
                .allowIfSubType("java.time")
                .allowIfSubType("java.lang")
                .build();

        ObjectMapper redisOm = new ObjectMapper().findAndRegisterModules();
        // Keep polymorphic typing for cached Object values, using a property when possible.
        redisOm.activateDefaultTypingAsProperty(
                ptv,
                ObjectMapper.DefaultTyping.NON_FINAL,
                "@class"
        );




        var valueSerializer = new GenericJackson2JsonRedisSerializer(redisOm);

        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                // IMPORTANT: bump this when serialization format changes
                .computePrefixWith(cacheName -> "bb:v9:" + cacheName + "::")
                .entryTtl(defaultTtl)
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(valueSerializer));

        Map<String, RedisCacheConfiguration> perCache = new java.util.HashMap<>(Map.of(
                "catalog.categories",          base.entryTtl(Duration.ofHours(12)),
                "catalog.productById",         base.entryTtl(Duration.ofMinutes(30)),
                "catalog.products.page",       base.entryTtl(Duration.ofMinutes(20)),
                "catalog.products.byCategory", base.entryTtl(Duration.ofMinutes(20)),
                "catalog.featured.page",       base.entryTtl(Duration.ofMinutes(20)),
                "catalog.featured.top",        base.entryTtl(Duration.ofMinutes(20)),
                "catalog.newArrivals",         base.entryTtl(Duration.ofMinutes(20))
        ));

        // Presigned URLs expire in 3600s, so keep cache < 3600s
        perCache.put("featureImages", base.entryTtl(Duration.ofMinutes(50)));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(base)
                .withInitialCacheConfigurations(perCache)
                .build();
    }

    /**
     * Cache error handler that self-heals bad/stale cache entries.
     * If a cached value can't be deserialized, evict it and treat it as a cache miss.
     */
    @Bean
    public CacheErrorHandler cacheErrorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException ex, Cache cache, Object key) {
                Throwable root = ex;
                while (root.getCause() != null) root = root.getCause();

                log.warn("Cache GET failed. Treating as miss. cache={} key={} rootType={} msg={}",
                        cache != null ? cache.getName() : "null",
                        key,
                        root.getClass().getName(),
                        root.getMessage());

                if (cache != null && (root instanceof JsonProcessingException
                        || root instanceof org.springframework.data.redis.serializer.SerializationException
                        || root instanceof org.springframework.data.redis.RedisSystemException)) {
                    try { cache.evict(key); } catch (Exception ignored) {}
                }

                // swallow => treat as miss
            }


            @Override public void handleCachePutError(RuntimeException ex, Cache cache, Object key, Object value) {
                log.warn("Cache PUT failed. cache={}, key={}", cache.getName(), key, ex.getMessage());
            }
            @Override public void handleCacheEvictError(RuntimeException ex, Cache cache, Object key) {
                log.warn("Cache EVICT failed. cache={}, key={}", cache.getName(), key, ex.getMessage());
            }
            @Override public void handleCacheClearError(RuntimeException ex, Cache cache) {
                log.warn("Cache CLEAR failed. cache={}", cache.getName(), ex.getMessage());
            }
        };
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return cacheErrorHandler();
    }

}
