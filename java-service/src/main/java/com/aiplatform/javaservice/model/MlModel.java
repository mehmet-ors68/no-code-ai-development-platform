package com.aiplatform.javaservice.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

// Lightweight model metadata — shown on the list page.
// Heavy config (hyperparameters, layers) lives in ModelSpec — loaded only on detail page.
@Data
@Entity
@Table(name = "ml_models")
public class MlModel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    // sklearn | DL | yolo | nlp
    @Column(nullable = false, length = 50)
    private String modelType = "sklearn";

    // draft | training | trained | failed
    @Column(nullable = false, length = 50)
    private String status = "draft";

    @Column(nullable = false)
    private UUID userId;

    // Which trained artifact this model serves. Null until a run completes.
    // Deliberately a plain UUID, not a @ManyToOne: a foreign key here would make
    // deleteExperiment fail on whichever run happens to be deployed. The pointer is
    // cleared explicitly instead — see deleteExperiment.
    private UUID deployedExperimentId;

    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;
}
