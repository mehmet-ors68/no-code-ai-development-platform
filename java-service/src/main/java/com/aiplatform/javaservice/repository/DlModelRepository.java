package com.aiplatform.javaservice.repository;

import com.aiplatform.javaservice.model.DlModel;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface DlModelRepository extends MongoRepository<DlModel, String> {
    List<DlModel> findByUserId(String userId);
}
