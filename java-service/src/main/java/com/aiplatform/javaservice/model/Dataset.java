package com.aiplatform.javaservice.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// One row per uploaded dataset. Every upload becomes a row here — there's no separate
// "ad-hoc file" path. A "repo" is just a Dataset that happens to get more versions later;
// today it's always exactly one file (fileKey), versioning is a future column, not a future table.
@Data
@Entity
@Table(name = "datasets")
public class Dataset {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false)
    private Integer rowCount;

    @Column(nullable = false)
    private Integer columnCount;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private List<String> columns;

    // Object path inside the PRIVATE "datasets" bucket, e.g. raw/<uuid>.csv.
    // Deliberately not a URL: a stored public URL would be readable by anyone who
    // ever saw it, forever, bypassing the ownership check below. Download links are
    // minted per request with a short expiry.
    @Column(nullable = false, length = 255)
    private String fileKey;

    @Column(nullable = false)
    private UUID userId;

    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;
}
