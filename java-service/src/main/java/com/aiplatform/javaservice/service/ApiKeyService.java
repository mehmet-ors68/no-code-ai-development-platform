package com.aiplatform.javaservice.service;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

// Mints and verifies serving credentials. The plaintext exists only inside a single
// create request — it is returned to the caller once and never written down.
@Service
public final class ApiKeyService {

    private static final String PREFIX = "dlp_";
    private static final int RANDOM_BYTES = 32;
    // Enough characters to distinguish keys in a list, few enough to be useless alone.
    private static final int PREFIX_CHARS = 4;

    private final SecureRandom random = new SecureRandom();
    private final Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();

    // dlp_ + 32 random bytes, base64url. The marker is there so a key found in a log
    // or a pasted config is recognizable as this platform's, not mistaken for a JWT.
    public String generate() {
        byte[] bytes = new byte[RANDOM_BYTES];
        random.nextBytes(bytes);
        return PREFIX + encoder.encodeToString(bytes);
    }

    public String hash(String key) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is required of every JVM. If it is missing, the platform is broken
            // in a way no caller can act on.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    public String prefixOf(String key) {
        return key.substring(0, Math.min(PREFIX.length() + PREFIX_CHARS, key.length()));
    }
}
