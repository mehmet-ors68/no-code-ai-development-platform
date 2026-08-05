package com.aiplatform.javaservice.repository;

import com.aiplatform.javaservice.model.Dataset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DatasetRepository extends JpaRepository<Dataset, UUID> {

    List<Dataset> findByUserIdOrderByCreatedAtDesc(UUID userId);

    boolean existsByIdAndUserId(UUID id, UUID userId);
}
