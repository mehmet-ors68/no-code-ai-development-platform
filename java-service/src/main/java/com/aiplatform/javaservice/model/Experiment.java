package com.aiplatform.javaservice.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

// Immutable record of a single training run — never updated after creation.
// Written by the Python service once training completes (POST /api/experiments).
// Answers: "which hyperparameters produced which metrics, for which model?"
@Data
@Entity
@Table(name = "experiments")
public class Experiment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id", nullable = false)
    private MlModel model;

    // Which spec version was active when this run started
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_spec_id")
    private ModelSpec modelSpec;

    // Exact params used in this run — may differ from modelSpec.config during HPO
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> hyperparameters;

    // accuracy, f1, rmse, loss — depends on model type
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> metrics;

    // Path to serialized model file (.joblib, .pt, .h5) on disk or S3
    @Column(length = 500)
    private String modelFilePath;

    // completed | failed
    @Column(length = 50)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    private Integer durationMs;

    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;
}
