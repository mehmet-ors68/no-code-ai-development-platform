package com.aiplatform.javaservice.controller;

import com.aiplatform.javaservice.dto.CreateModelRequest;
import com.aiplatform.javaservice.dto.UpdateModelRequest;
import com.aiplatform.javaservice.model.DlModel;
import com.aiplatform.javaservice.model.ModelInfo;
import com.aiplatform.javaservice.repository.DlModelRepository;
import com.aiplatform.javaservice.repository.ModelInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

// Node.js equivalent: routes/models.js
// X-User-ID is injected by Go Gateway after JWT validation — no JWT re-parsing here
@RestController
@RequestMapping("/api/models")
@RequiredArgsConstructor
public class ModelController {

    private final DlModelRepository dlModelRepository;
    private final ModelInfoRepository modelInfoRepository;

    @GetMapping
    public ResponseEntity<List<DlModel>> getModels(@RequestHeader("X-User-ID") String userId) {
        return ResponseEntity.ok(dlModelRepository.findByUserId(userId));
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> createModel(
            @RequestBody CreateModelRequest req,
            @RequestHeader("X-User-ID") String userId) {

        DlModel model = new DlModel();
        model.setTitle(req.title());
        model.setDescription(req.description());
        model.setStatus("created");
        model.setUserId(userId);
        DlModel saved = dlModelRepository.save(model);

        ModelInfo info = new ModelInfo();
        info.setModelId(saved.getId());
        modelInfoRepository.save(info);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("modelId", saved.getId(), "message", "Model created"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateModel(
            @PathVariable String id,
            @RequestBody UpdateModelRequest req,
            @RequestHeader("X-User-ID") String userId) {

        DlModel model = dlModelRepository.findById(id).orElse(null);
        if (model == null) return ResponseEntity.notFound().build();
        if (!model.getUserId().equals(userId)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        model.setTitle(req.title());
        model.setDescription(req.description());
        model.setUpdatedAt(Instant.now());
        return ResponseEntity.ok(dlModelRepository.save(model));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteModel(
            @PathVariable String id,
            @RequestHeader("X-User-ID") String userId) {

        DlModel model = dlModelRepository.findById(id).orElse(null);
        if (model == null) return ResponseEntity.notFound().build();
        if (!model.getUserId().equals(userId)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        dlModelRepository.deleteById(id);
        modelInfoRepository.deleteByModelId(id);
        return ResponseEntity.ok(Map.of("message", "Model deleted"));
    }

}
