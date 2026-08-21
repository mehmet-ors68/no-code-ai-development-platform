package com.aiplatform.javaservice.dto;

import java.time.Instant;

// Never serialize the ApiKey entity itself: it carries keyHash and a lazy model
// reference, and one forgotten @JsonIgnore would put the hash on the wire.
public record ApiKeyResponse(
    String id,
    String label,
    String keyPrefix,
    Instant createdAt
) {}
