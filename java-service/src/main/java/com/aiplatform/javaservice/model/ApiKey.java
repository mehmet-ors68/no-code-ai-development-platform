package com.aiplatform.javaservice.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

// A credential that authorizes calling exactly one model from outside the browser.
// Scoped to a model rather than an account so handing one out cannot leak the rest
// of the user's work, and revoking one cannot break their other integrations.
@Data
@Entity
@Table(name = "api_keys")
public class ApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // The owning user is reached through model.getUserId(). Copying it onto this row
    // would be a second source of truth for the same fact, free to drift.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id", nullable = false)
    private MlModel model;

    // SHA-256 of the presented key, not bcrypt: bcrypt exists to make guessing
    // low-entropy passwords expensive, and this secret is 256 bits of SecureRandom.
    // There is nothing to slow down, and bcrypt would turn one indexed lookup into a
    // scan-and-compare over every row.
    @Column(nullable = false, unique = true, length = 64)
    private String keyHash;

    // First few characters, kept in the clear purely so the list UI can tell two
    // keys apart. Too short to narrow a brute-force search of the remaining bits.
    @Column(nullable = false, length = 16)
    private String keyPrefix;

    @Column(length = 100)
    private String label;

    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;
}
