package com.blossombuds.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Map;

/** Redis cache configuration for Spring Cache with a dedicated Redis ObjectMapper. */
@Configuration
@EnableCaching
public class RedisConfig {

    /** Creates an ObjectMapper used only for Redis value serialization. */
    /*@Bean
    public ObjectMapper redisObjectMapper() {
        BasicPolymorphicTypeValidator ptv = BasicPolymorphicTypeValidator.builder()
                .allowIfSubType("com.blossombuds.dto")
                .allowIfSubType("org.springframework.data")
                .allowIfSubType("java.math")
                .allowIfSubType("java.util")
                .allowIfSubType("java.time")
                .build();

        ObjectMapper om = new ObjectMapper();
        om.findAndRegisterModules();
        // Type info needed for generic DTOs like CachedPage<T> (stored only in Redis JSON)
        om.activateDefaultTyping(ptv, ObjectMapper.DefaultTyping.NON_FINAL);
        return om;
    }*/

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
        // IMPORTANT: keep type info in Redis (but only for allowed packages)
        redisOm.activateDefaultTypingAsProperty(ptv, ObjectMapper.DefaultTyping.NON_FINAL, "@class");

        var valueSerializer = new GenericJackson2JsonRedisSerializer(redisOm);

        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
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
}
