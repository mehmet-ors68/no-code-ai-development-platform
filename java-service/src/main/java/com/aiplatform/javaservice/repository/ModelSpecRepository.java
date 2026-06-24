package com.aiplatform.javaservice.repository;

import com.aiplatform.javaservice.model.ModelSpec;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ModelSpecRepository extends JpaRepository<ModelSpec, UUID> {

    Optional<ModelSpec> findByModelIdAndIsActiveTrue(UUID modelId);

    List<ModelSpec> findByModelIdOrderByVersionDesc(UUID modelId);

    @Query("SELECT COALESCE(MAX(s.version), 0) FROM ModelSpec s WHERE s.model.id = :modelId")
    Integer findMaxVersionByModelId(UUID modelId);

    // @Modifying requires @Transactional — UPDATE/DELETE queries need explicit tx
    @Modifying
    @Transactional
    @Query("UPDATE ModelSpec s SET s.isActive = false WHERE s.model.id = :modelId")
    void deactivateAllByModelId(UUID modelId);
}
