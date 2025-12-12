package com.blossombuds.config;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

@Configuration
@EnableCaching
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // Use String serializer for keys
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());

        // Configure ObjectMapper with JavaTimeModule
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        mapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        mapper.activateDefaultTyping(
            mapper.getPolymorphicTypeValidator(),
            com.fasterxml.jackson.databind.ObjectMapper.DefaultTyping.NON_FINAL,
            com.fasterxml.jackson.annotation.JsonTypeInfo.As.PROPERTY
        );
        mapper.addMixIn(org.springframework.data.domain.PageImpl.class, PageImplMixin.class);
        
        com.fasterxml.jackson.databind.module.SimpleModule pageModule = new com.fasterxml.jackson.databind.module.SimpleModule();
        pageModule.addDeserializer(org.springframework.data.domain.Pageable.class, new PageableDeserializer());
        mapper.registerModule(pageModule);

        GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer(mapper);

        // Use JSON serializer for values
        template.setValueSerializer(serializer);
        template.setHashValueSerializer(serializer);

        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        // Configure ObjectMapper with JavaTimeModule
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        mapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        mapper.activateDefaultTyping(
            mapper.getPolymorphicTypeValidator(),
            com.fasterxml.jackson.databind.ObjectMapper.DefaultTyping.NON_FINAL,
            com.fasterxml.jackson.annotation.JsonTypeInfo.As.PROPERTY
        );
        mapper.addMixIn(org.springframework.data.domain.PageImpl.class, PageImplMixin.class);

        com.fasterxml.jackson.databind.module.SimpleModule pageModule = new com.fasterxml.jackson.databind.module.SimpleModule();
        pageModule.addDeserializer(org.springframework.data.domain.Pageable.class, new PageableDeserializer());
        mapper.registerModule(pageModule);

        GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer(mapper);

        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(1)) // Default TTL 1 hour
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(serializer));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(config)
                .build();
    }

    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    static class PageImplMixin {
        @com.fasterxml.jackson.annotation.JsonCreator
        public PageImplMixin(
                @com.fasterxml.jackson.annotation.JsonProperty("content") java.util.List<?> content,
                @com.fasterxml.jackson.annotation.JsonProperty("pageable") org.springframework.data.domain.Pageable pageable,
                @com.fasterxml.jackson.annotation.JsonProperty("totalElements") long total) {
        }
    }

    static class PageableDeserializer extends com.fasterxml.jackson.databind.JsonDeserializer<org.springframework.data.domain.Pageable> {
        @Override
        public org.springframework.data.domain.Pageable deserialize(com.fasterxml.jackson.core.JsonParser p, com.fasterxml.jackson.databind.DeserializationContext ctxt) throws java.io.IOException {
            com.fasterxml.jackson.databind.JsonNode node = p.getCodec().readTree(p);
            if (node.has("pageNumber") && node.has("pageSize")) {
                int page = node.get("pageNumber").asInt();
                int size = node.get("pageSize").asInt();
                return org.springframework.data.domain.PageRequest.of(page, size, org.springframework.data.domain.Sort.unsorted());
            }
            return org.springframework.data.domain.Pageable.unpaged();
        }
    }
}
