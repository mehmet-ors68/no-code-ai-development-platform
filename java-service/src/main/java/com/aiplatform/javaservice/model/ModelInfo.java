package com.aiplatform.javaservice.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

// Loaded only when user opens a specific model's detail page — not on the list view.
// Keeps the models list lightweight (DlModel) and detail heavy data here.
@Data
@Document(collection = "modelInfo")
public class ModelInfo {
    @Id
    private String id;
    private String modelId;

    // "sklearn" | "yolo" | "huggingface" | "custom-dl"
    private String modelType;

    // Flexible map — different model types have different hyperparameters.
    // sklearn: {n_estimators, max_depth, ...}
    // neural net: {learningRate, epochs, optimizer, batchSize, ...}
    // yolo: {confidenceThreshold, iouThreshold, ...}
    private Map<String, Object> trainingConfig;

    // File paths — actual model weights live here, not in DB
    private String datasetPath;
    private String modelFilePath;

    // Populated after training completes
    private Map<String, Object> trainingMetrics;

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();
}
