package com.aiplatform.javaservice.controller;

import com.aiplatform.javaservice.dto.ApiKeyResponse;
import com.aiplatform.javaservice.dto.CreateApiKeyRequest;
import com.aiplatform.javaservice.model.ApiKey;
import com.aiplatform.javaservice.model.MlModel;
import com.aiplatform.javaservice.repository.ApiKeyRepository;
import com.aiplatform.javaservice.repository.MlModelRepository;
import com.aiplatform.javaservice.service.ApiKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// Key management for the browser session. Reached through the gateway's protected
// group like every other /api/models/* route, so X-User-ID is gateway-asserted here.
// Verification for external callers is a different door — see InternalApiKeyController.
@RestController
@RequestMapping("/api/models/{modelId}/api-keys")
@RequiredArgsConstructor
public class ApiKeyController {

    private final ApiKeyRepository apiKeyRepository;
    private final MlModelRepository mlModelRepository;
    private final ApiKeyService apiKeyService;

    // POST — mint a key for this model. The plaintext is in this response and nowhere
    // else, ever again: only its SHA-256 is stored.
    @PostMapping
    public ResponseEntity<?> createKey(
            @PathVariable UUID modelId,
            @RequestBody CreateApiKeyRequest req,
            @RequestHeader("X-User-ID") String userId) {

        MlModel model = mlModelRepository.findById(modelId).orElse(null);
        if (model == null) return ResponseEntity.notFound().build();
        if (!model.getUserId().equals(UUID.fromString(userId))) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        String plaintext = apiKeyService.generate();

        ApiKey key = new ApiKey();
        key.setModel(model);
        key.setKeyHash(apiKeyService.hash(plaintext));
        key.setKeyPrefix(apiKeyService.prefixOf(plaintext));
        key.setLabel(req.label());

        ApiKey saved = apiKeyRepository.save(key);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id",        saved.getId().toString(),
                "label",     saved.getLabel() != null ? saved.getLabel() : "",
                "keyPrefix", saved.getKeyPrefix(),
                "createdAt", saved.getCreatedAt().toString(),
                "key",       plaintext
        ));
    }

    @GetMapping
    public ResponseEntity<?> listKeys(
            @PathVariable UUID modelId,
            @RequestHeader("X-User-ID") String userId) {

        if (!mlModelRepository.existsByIdAndUserId(modelId, UUID.fromString(userId))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<ApiKeyResponse> keys = apiKeyRepository.findByModelIdOrderByCreatedAtDesc(modelId).stream()
                .map(k -> new ApiKeyResponse(
                        k.getId().toString(),
                        k.getLabel(),
                        k.getKeyPrefix(),
                        k.getCreatedAt()))
                .toList();

        return ResponseEntity.ok(keys);
    }

    // DELETE — revocation is the row disappearing. No revoked_at to filter on, and
    // nothing left that a later bug could treat as still valid.
    @DeleteMapping("/{keyId}")
    public ResponseEntity<?> deleteKey(
            @PathVariable UUID modelId,
            @PathVariable UUID keyId,
            @RequestHeader("X-User-ID") String userId) {

        if (!mlModelRepository.existsByIdAndUserId(modelId, UUID.fromString(userId))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        ApiKey key = apiKeyRepository.findById(keyId).orElse(null);
        // The modelId check matters: without it, owning any model would be enough to
        // delete a key belonging to any other model, including someone else's.
        if (key == null || !key.getModel().getId().equals(modelId)) {
            return ResponseEntity.notFound().build();
        }

        apiKeyRepository.deleteById(keyId);
        return ResponseEntity.ok(Map.of("message", "API key revoked"));
    }
}
