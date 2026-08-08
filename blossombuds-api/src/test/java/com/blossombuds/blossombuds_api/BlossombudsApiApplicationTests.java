package com.blossombuds.blossombuds_api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

/**
 * Verifies the Spring context starts and every bean wires up.
 *
 * The local profile leaves several values as bare ${PLACEHOLDER}s with no default, expecting them
 * from the environment. A developer running `mvn test` on a fresh clone has none of them set, so
 * context startup failed on the first unresolved placeholder — this test could never pass without
 * a hand-configured shell. Dummy values are supplied here so the check is about wiring, which is
 * what it is for, rather than about whose machine it runs on.
 *
 * These are deliberately obvious fakes: nothing here reaches an external service during the test.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "app.jwt.secret=test-only-jwt-secret-not-used-outside-tests-min-32-bytes",
        "app.category.default-image-url=http://localhost/test-category-default.jpg",
        "app.mail.apiKey=",
        "app.mail.from=test@example.invalid",
        "app.frontend.baseUrl=http://localhost:5173",
        "app.backend.baseUrl=http://localhost:8080",
        "cloudflare.r2.endpoint=http://localhost:9000",
        "cloudflare.r2.accessKey=test",
        "cloudflare.r2.secretKey=test",
        "cloudflare.r2.bucket=test-bucket",
        "razorpay.keyId=rzp_test_placeholder",
        "razorpay.keySecret=test",
        "razorpay.webhookSecret=test",
        "msg91.authkey=",
        "spring.mail.username=test@example.invalid",
        "spring.mail.password=test",
        // Spring Security rejects an empty client id outright, so this needs a value even though
        // no OAuth2 flow runs during the test.
        "spring.security.oauth2.client.registration.google.client-id=test-client-id",
        "spring.security.oauth2.client.registration.google.client-secret=test-client-secret"
})
class BlossombudsApiApplicationTests {

	@Test
	void contextLoads() {
	}

}
