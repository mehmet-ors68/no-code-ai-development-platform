package com.aiplatform.javaservice.dto;

import java.util.Map;

public record CreateExperimentRequest(
    Map<String, Object> hyperparameters,
    Map<String, Object> metrics,
    String status,
    Integer durationMs
) {}
