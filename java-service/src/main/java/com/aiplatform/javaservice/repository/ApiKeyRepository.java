package com.aiplatform.javaservice.repository;

import com.aiplatform.javaservice.model.ApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApiKeyRepository extends JpaRepository<ApiKey, UUID> {

    // The verify path: hash what the caller presented, look it up on the unique index.
    Optional<ApiKey> findByKeyHash(String keyHash);

    List<ApiKey> findByModelIdOrderByCreatedAtDesc(UUID modelId);

    // Called before deleting a model. Hibernate creates the api_keys foreign key with
    // the default NO ACTION, so leaving keys behind would make model deletion fail on
    // a constraint violation instead.
    void deleteByModelId(UUID modelId);
}
