package com.aiplatform.javaservice.dto;

import java.util.Map;

public record CreateExperimentRequest(
    Map<String, Object> hyperparameters,
    Map<String, Object> metrics,
    String status,
    Integer durationMs,
    // Object path in the private "ml-models" bucket, e.g. models/<uuid>.joblib
    String modelKey
) {}
