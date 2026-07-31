package com.aiplatform.javaservice.controller;

import com.aiplatform.javaservice.dto.CreateExperimentRequest;
import com.aiplatform.javaservice.dto.CreateModelRequest;
import com.aiplatform.javaservice.dto.UpdateModelRequest;
import com.aiplatform.javaservice.model.Experiment;
import com.aiplatform.javaservice.model.MlModel;
import com.aiplatform.javaservice.model.ModelSpec;
import com.aiplatform.javaservice.repository.ExperimentRepository;
import com.aiplatform.javaservice.repository.MlModelRepository;
import com.aiplatform.javaservice.repository.ModelSpecRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// X-User-ID header is injected by Go Gateway after JWT validation — no JWT parsing here.
// All IDs are UUID — parse from String header/path variable at the boundary.
@RestController
@RequestMapping("/api/models")
@RequiredArgsConstructor
public class ModelController {

    private final MlModelRepository mlModelRepository;
    private final ModelSpecRepository modelSpecRepository;
    private final ExperimentRepository experimentRepository;

    // GET /api/models — list all models for the authenticated user (lightweight, no spec)
    @GetMapping
    public ResponseEntity<List<MlModel>> getModels(@RequestHeader("X-User-ID") String userId) {
        return ResponseEntity.ok(mlModelRepository.findByUserId(UUID.fromString(userId)));
    }

    // GET /api/models/:id — model detail + active spec (for the detail page header)
    @GetMapping("/{id}")
    public ResponseEntity<?> getModel(
            @PathVariable UUID id,
            @RequestHeader("X-User-ID") String userId) {

        MlModel model = mlModelRepository.findById(id).orElse(null);
        if (model == null) return ResponseEntity.notFound().build();
        if (!model.getUserId().equals(UUID.fromString(userId))) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        ModelSpec activeSpec = modelSpecRepository.findByModelIdAndIsActiveTrue(id).orElse(null);

        return ResponseEntity.ok(Map.of(
                "model", model,
                "spec", activeSpec != null ? activeSpec : Map.of()
        ));
    }

    // POST /api/models — create model + empty spec in one transaction
    @PostMapping
    public ResponseEntity<Map<String, String>> createModel(
            @RequestBody CreateModelRequest req,
            @RequestHeader("X-User-ID") String userId) {

        String resolvedType = req.modelType() != null ? req.modelType() : "sklearn";

        MlModel model = new MlModel();
        model.setTitle(req.title());
        model.setDescription(req.description());
        model.setModelType(resolvedType);
        model.setUserId(UUID.fromString(userId));

        MlModel saved = mlModelRepository.save(model);

        // Create an empty spec immediately — detail page always has a spec to load
        ModelSpec spec = new ModelSpec();
        spec.setModel(saved);
        spec.setModelType(resolvedType);
        modelSpecRepository.save(spec);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("modelId", saved.getId().toString(), "message", "Model created"));
    }

    // PUT /api/models/:id — update title/description only (spec is versioned separately)
    @PutMapping("/{id}")
    public ResponseEntity<?> updateModel(
            @PathVariable UUID id,
            @RequestBody UpdateModelRequest req,
            @RequestHeader("X-User-ID") String userId) {

        MlModel model = mlModelRepository.findById(id).orElse(null);
        if (model == null) return ResponseEntity.notFound().build();
        if (!model.getUserId().equals(UUID.fromString(userId))) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        model.setTitle(req.title());
        model.setDescription(req.description());
        return ResponseEntity.ok(mlModelRepository.save(model));
    }

    // DELETE /api/models/:id — cascade deletes specs + experiments via FK constraints
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteModel(
            @PathVariable UUID id,
            @RequestHeader("X-User-ID") String userId) {

        MlModel model = mlModelRepository.findById(id).orElse(null);
        if (model == null) return ResponseEntity.notFound().build();
        if (!model.getUserId().equals(UUID.fromString(userId))) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        mlModelRepository.deleteById(id);
        // ModelSpec and Experiment rows deleted automatically by ON DELETE CASCADE

        return ResponseEntity.ok(Map.of("message", "Model deleted"));
    }

    // GET /api/models/:id/specs — all spec versions, newest first (for the Mimari tab version history)
    @GetMapping("/{id}/specs")
    public ResponseEntity<?> getSpecs(
            @PathVariable UUID id,
            @RequestHeader("X-User-ID") String userId) {

        if (!mlModelRepository.existsByIdAndUserId(id, UUID.fromString(userId))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(modelSpecRepository.findByModelIdOrderByVersionDesc(id));
    }

    // POST /api/models/:id/specs — save new config version
    // Deactivates all previous versions, inserts a new spec row with version = max+1.
    // Why a new row instead of updating in place: experiments reference spec_id as FK,
    // so we never mutate a spec that may have already been used in a training run.
    @PostMapping("/{id}/specs")
    @Transactional
    public ResponseEntity<?> saveSpec(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @RequestHeader("X-User-ID") String userId) {

        MlModel model = mlModelRepository.findById(id).orElse(null);
        if (model == null) return ResponseEntity.notFound().build();
        if (!model.getUserId().equals(UUID.fromString(userId))) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        // Deactivate all existing versions before creating the new one
        modelSpecRepository.deactivateAllByModelId(id);

        int nextVersion = modelSpecRepository.findMaxVersionByModelId(id) + 1;

        ModelSpec spec = new ModelSpec();
        spec.setModel(model);
        spec.setVersion(nextVersion);
        spec.setIsActive(true);
        spec.setModelType((String) body.get("modelType"));
        spec.setDatasetPath((String) body.get("datasetPath"));

        @SuppressWarnings("unchecked")
        Map<String, Object> config = (Map<String, Object>) body.get("config");
        spec.setConfig(config);

        ModelSpec saved = modelSpecRepository.save(spec);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // GET /api/models/:id/experiments — training history for the Eğitim tab
    @GetMapping("/{id}/experiments")
    public ResponseEntity<?> getExperiments(
            @PathVariable UUID id,
            @RequestHeader("X-User-ID") String userId) {

        if (!mlModelRepository.existsByIdAndUserId(id, UUID.fromString(userId))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(experimentRepository.findByModelIdOrderByCreatedAtDesc(id));
    }

    // POST /api/models/:id/experiments — save training run result (called by frontend after Python returns)
    @PostMapping("/{id}/experiments")
    @Transactional
    public ResponseEntity<?> saveExperiment(
            @PathVariable UUID id,
            @RequestBody CreateExperimentRequest req,
            @RequestHeader("X-User-ID") String userId) {

        MlModel model = mlModelRepository.findById(id).orElse(null);
        if (model == null) return ResponseEntity.notFound().build();
        if (!model.getUserId().equals(UUID.fromString(userId))) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        ModelSpec activeSpec = modelSpecRepository.findByModelIdAndIsActiveTrue(id).orElse(null);

        Experiment exp = new Experiment();
        exp.setModel(model);
        exp.setModelSpec(activeSpec);
        exp.setHyperparameters(req.hyperparameters());
        exp.setMetrics(req.metrics());
        exp.setStatus(req.status() != null ? req.status() : "completed");
        exp.setDurationMs(req.durationMs());

        experimentRepository.save(exp);

        // Update model status to "trained" on successful run
        if ("completed".equals(exp.getStatus())) {
            model.setStatus("trained");
            mlModelRepository.save(model);
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Experiment saved"));
    }
}
