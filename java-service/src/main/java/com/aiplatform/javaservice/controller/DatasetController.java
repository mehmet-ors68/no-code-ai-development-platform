package com.aiplatform.javaservice.controller;

import com.aiplatform.javaservice.dto.CreateDatasetRequest;
import com.aiplatform.javaservice.model.Dataset;
import com.aiplatform.javaservice.repository.DatasetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// Rows are created and deleted by python-ml-service over the internal Docker network —
// it owns every Storage interaction, so it uploads the file before POSTing here and
// removes the object before calling DELETE here. Java never touches the file itself; it
// stores only the object path (fileKey) and the ownership record.
//
// X-User-ID is injected by Go Gateway after JWT validation. Python forwards the same
// header it received, so ownership is preserved regardless of which service calls us.
@RestController
@RequestMapping("/api/datasets")
@RequiredArgsConstructor
public class DatasetController {

    private final DatasetRepository datasetRepository;

    // GET /api/datasets — list for the authenticated user, newest first
    @GetMapping
    public ResponseEntity<List<Dataset>> getDatasets(@RequestHeader("X-User-ID") String userId) {
        return ResponseEntity.ok(
                datasetRepository.findByUserIdOrderByCreatedAtDesc(UUID.fromString(userId)));
    }

    // GET /api/datasets/:id — single dataset (for the upcoming detail page)
    @GetMapping("/{id}")
    public ResponseEntity<?> getDataset(
            @PathVariable UUID id,
            @RequestHeader("X-User-ID") String userId) {

        Dataset dataset = datasetRepository.findById(id).orElse(null);
        if (dataset == null) return ResponseEntity.notFound().build();
        if (!dataset.getUserId().equals(UUID.fromString(userId))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(dataset);
    }

    // POST /api/datasets — called by python-ml-service, not by the browser.
    // Returns the whole saved entity (unlike ModelController, which returns just an id):
    // Python passes this response straight through to the frontend, which needs every
    // field to render the card without a follow-up GET.
    @PostMapping
    public ResponseEntity<Dataset> createDataset(
            @RequestBody CreateDatasetRequest req,
            @RequestHeader("X-User-ID") String userId) {

        Dataset dataset = new Dataset();
        dataset.setName(req.name());
        dataset.setRowCount(req.rowCount());
        dataset.setColumnCount(req.columnCount());
        dataset.setColumns(req.columns());
        dataset.setFileKey(req.fileKey());
        dataset.setUserId(UUID.fromString(userId));

        return ResponseEntity.status(HttpStatus.CREATED).body(datasetRepository.save(dataset));
    }

    // DELETE /api/datasets/:id — called by python-ml-service AFTER it has removed the
    // object from Storage. The frontend calls DELETE /api/ml/datasets/:id instead, so the
    // file and the row always go together and no orphans accumulate.
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDataset(
            @PathVariable UUID id,
            @RequestHeader("X-User-ID") String userId) {

        if (!datasetRepository.existsByIdAndUserId(id, UUID.fromString(userId))) {
            return ResponseEntity.notFound().build();
        }
        datasetRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Dataset deleted"));
    }
}
