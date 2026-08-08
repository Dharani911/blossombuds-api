package com.blossombuds.web;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Locks C2: the classifier that keeps credential-bearing settings from ever being returned to an
 * unauthenticated caller. The list()/get() endpoints filter on {@code isSecretKey}, so if this
 * ever starts returning false for a real secret, the WhatsApp token becomes public again.
 */
class SettingsControllerSecretKeyTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "whatsapp.cloud.access_token",
            "whatsapp.cloud.app_secret",
            "whatsapp.cloud.verify_token",
            "WHATSAPP.CLOUD.ACCESS_TOKEN",   // case-insensitive
            "msg91.authkey",
            "some.new.api_key",
            "provider.password",
            "x.private_key"
    })
    void treatsCredentialKeysAsSecret(String key) {
        assertThat(SettingsController.isSecretKey(key)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "brand.whatsapp",
            "brand.name",
            "brand.gstin",
            "policy.privacy",
            "about.terms_and_conditions",
            "shipping.free_threshold",
            "checkout.gst.enabled",
            "ui.topbanner_coupon"
    })
    void treatsPublicDisplayKeysAsNonSecret(String key) {
        assertThat(SettingsController.isSecretKey(key)).isFalse();
    }

    @Test
    void nullOrBlankIsNotSecret() {
        assertThat(SettingsController.isSecretKey(null)).isFalse();
        assertThat(SettingsController.isSecretKey("   ")).isFalse();
    }
}
