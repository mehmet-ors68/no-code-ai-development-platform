package com.aiplatform.javaservice.controller;

import com.aiplatform.javaservice.dto.VerifyApiKeyRequest;
import com.aiplatform.javaservice.model.ApiKey;
import com.aiplatform.javaservice.repository.ApiKeyRepository;
import com.aiplatform.javaservice.service.ApiKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// Service-to-service only. Mapped outside /api/ on purpose: every gateway route is
// under /api/, so no proxy rule can reach this path from the public side.
//
// KNOWN BOUNDARY: nothing here authenticates the caller. SecurityConfig is
// anyRequest().permitAll(), so this endpoint is guarded by network isolation alone —
// compose binds every backend port to 127.0.0.1. That holds on a single host and
// stops holding the moment these services share a network with anything else.
// Production wants a shared secret or mTLS on this hop.
@RestController
@RequestMapping("/internal/api-keys")
@RequiredArgsConstructor
public class InternalApiKeyController {

    private final ApiKeyRepository apiKeyRepository;
    private final ApiKeyService apiKeyService;

    // The key arrives in the body, never in the path: a URL is written to every access
    // log between the gateway and here, and a logged key is a leaked key.
    @PostMapping("/verify")
    public ResponseEntity<?> verify(@RequestBody VerifyApiKeyRequest req) {
        if (req.key() == null || req.key().isBlank()) {
            return ResponseEntity.notFound().build();
        }

        ApiKey key = apiKeyRepository.findByKeyHash(apiKeyService.hash(req.key())).orElse(null);
        if (key == null) {
            return ResponseEntity.notFound().build();
        }

        // The identity the gateway will assert downstream. Both facts come from the one
        // foreign key, so they cannot disagree about who owns what.
        return ResponseEntity.ok(Map.of(
                "userId",  key.getModel().getUserId().toString(),
                "modelId", key.getModel().getId().toString()
        ));
    }
}
