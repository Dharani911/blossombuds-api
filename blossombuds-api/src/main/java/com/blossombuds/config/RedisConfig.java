package com.blossombuds.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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
public class RedisConfig {

    /** Builds a RedisCacheManager with JSON values and string keys. */
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
                .build();

        ObjectMapper redisOm = new ObjectMapper().findAndRegisterModules();
        // Keep polymorphic typing for cached Object values, using a property when possible.
        redisOm.activateDefaultTyping(ptv, ObjectMapper.DefaultTyping.NON_FINAL, JsonTypeInfo.As.PROPERTY);

        var valueSerializer = new GenericJackson2JsonRedisSerializer(redisOm);

        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                // IMPORTANT: bump this when serialization format changes
                .computePrefixWith(cacheName -> "bb:v2:" + cacheName + "::")
                .entryTtl(defaultTtl)
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(valueSerializer));

        Map<String, RedisCacheConfiguration> perCache = Map.of(
                "catalog.categories",          base.entryTtl(Duration.ofHours(12)),
                "catalog.productById",         base.entryTtl(Duration.ofMinutes(30)),
                "catalog.products.page",       base.entryTtl(Duration.ofMinutes(20)),
                "catalog.products.byCategory", base.entryTtl(Duration.ofMinutes(20)),
                "catalog.featured.page",       base.entryTtl(Duration.ofMinutes(20)),
                "catalog.featured.top",        base.entryTtl(Duration.ofMinutes(20)),
                "catalog.newArrivals",         base.entryTtl(Duration.ofMinutes(20))
        );

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
            /** Handles Redis cache get errors by evicting the bad key (prevents 500s). */
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                if (exception instanceof SerializationException) {
                    log.warn("Cache deserialization failed. Evicting key. cache={}, key={}", cache.getName(), key, exception);
                    try { cache.evict(key); } catch (Exception ignored) {}
                    return; // proceed as cache miss
                }
                throw exception;
            }

            /** Handles Redis cache put errors by logging (does not break the request). */
            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                log.warn("Cache put failed. cache={}, key={}", cache.getName(), key, exception);
            }

            /** Handles Redis cache evict errors by logging. */
            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Cache evict failed. cache={}, key={}", cache.getName(), key, exception);
            }

            /** Handles Redis cache clear errors by logging. */
            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                log.warn("Cache clear failed. cache={}", cache.getName(), exception);
            }
        };
    }
}
