package com.aiplatform.javaservice.exception;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

// Catches exceptions from ALL controllers — no try-catch needed in individual controllers
// Node.js equivalent: app.use((err, req, res, next) => { ... }) global error middleware
@RestControllerAdvice
public class GlobalExceptionHandler {

    // Triggered when @Valid fails on a request body field
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(err -> errors.put(err.getField(), err.getDefaultMessage()));
        return ResponseEntity.badRequest().body(Map.of(
                "message", "Validation failed",
                "errors", errors
        ));
    }

    // Triggered when MongoDB unique index is violated (race condition bypass of existsBy* checks)
    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<?> handleDuplicate(DuplicateKeyException ex) {
        String msg = ex.getMessage() != null ? ex.getMessage() : "";
        if (msg.contains("username_1")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username already taken"));
        }
        if (msg.contains("email_1")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email already in use"));
        }
        return ResponseEntity.badRequest().body(Map.of("message", "Duplicate value"));
    }
}
