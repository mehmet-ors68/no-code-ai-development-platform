package com.aiplatform.javaservice.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

// One row per config version. A model can have many specs (1:N).
// Each "Save new version" inserts a new row and sets the previous one to is_active=false.
// Immutable after creation — never updated, only inserted.
//
// config is JSONB because each model type has a completely different structure:
//   sklearn:     {n_estimators, max_depth, criterion, ...}
//   neural_net:  {layers: [{type, units, activation}, ...], learning_rate, epochs, ...}
//   yolo:        {base_model, conf_threshold, iou_threshold, classes: [...], ...}
//   huggingface: {base_model, task, num_labels, label_mapping: {...}, ...}
@Data
@Entity
@Table(
    name = "model_specs",
    uniqueConstraints = @UniqueConstraint(columnNames = {"model_id", "version"})
)
public class ModelSpec {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id", nullable = false)
    private MlModel model;

    // Incremented on each save — (model_id, version) is unique
    @Column(nullable = false)
    private Integer version = 1;

    // Only one spec per model can be active at a time
    @Column(nullable = false)
    private Boolean isActive = true;

    // sklearn | neural_net | yolo | huggingface
    @Column(nullable = false, length = 50)
    private String modelType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> config;

    @Column(length = 500)
    private String datasetPath;

    // No updatedAt — specs are immutable. New version = new row.
    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;
}
