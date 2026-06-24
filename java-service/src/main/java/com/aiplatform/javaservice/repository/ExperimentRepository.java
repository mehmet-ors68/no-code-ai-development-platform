package com.aiplatform.javaservice.repository;

import com.aiplatform.javaservice.model.Experiment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExperimentRepository extends JpaRepository<Experiment, UUID> {

    // All training runs for a model, newest first — shown in the Training tab
    List<Experiment> findByModelIdOrderByCreatedAtDesc(UUID modelId);
}
