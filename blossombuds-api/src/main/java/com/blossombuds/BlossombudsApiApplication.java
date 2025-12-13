package com.blossombuds;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@Slf4j
@SpringBootApplication(exclude = {
    org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration.class
})
public class BlossombudsApiApplication {

	public static void main(String[] args) {
		log.info("🚀 Starting BlossomBuds API application...");
		try {
			SpringApplication.run(BlossombudsApiApplication.class, args);
			log.info("✅ BlossomBuds API started successfully.");
		} catch (Exception e) {
			log.error("❌ Application failed to start.", e);
			throw e; // rethrow to make sure Spring fails fast
		}
	}

}
