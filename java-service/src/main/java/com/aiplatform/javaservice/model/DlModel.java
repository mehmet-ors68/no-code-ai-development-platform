package com.aiplatform.javaservice.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

// Node.js equivalent: savedWorkSchema in modelModel.js
// @Document maps this class to the "models" collection in MongoDB
@Data
@Document(collection = "models")
public class DlModel {
    @Id
    private String id;
    private String title;
    private String description;
    private String status;
    private String userId;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();
}
