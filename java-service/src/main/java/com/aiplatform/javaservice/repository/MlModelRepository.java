package com.aiplatform.javaservice.repository;

import com.aiplatform.javaservice.model.MlModel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MlModelRepository extends JpaRepository<MlModel, UUID> {

    List<MlModel> findByUserId(UUID userId);

    boolean existsByIdAndUserId(UUID id, UUID userId);
}
