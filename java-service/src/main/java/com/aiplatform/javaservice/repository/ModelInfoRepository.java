package com.aiplatform.javaservice.repository;

import com.aiplatform.javaservice.model.ModelInfo;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ModelInfoRepository extends MongoRepository<ModelInfo, String> {
    Optional<ModelInfo> findByModelId(String modelId);
    void deleteByModelId(String modelId);
}
