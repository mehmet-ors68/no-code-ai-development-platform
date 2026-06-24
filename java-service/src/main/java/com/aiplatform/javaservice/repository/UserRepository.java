package com.aiplatform.javaservice.repository;

import com.aiplatform.javaservice.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

// Spring Data generates all SQL from method names — same convention as MongoRepository.
// Only the parent interface changed: MongoRepository<User, String> → JpaRepository<User, UUID>
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);

    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
}
