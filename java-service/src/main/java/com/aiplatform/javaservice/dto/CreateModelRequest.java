package com.aiplatform.javaservice.dto;

// modelType is set at creation time and determines the UI shown on the detail page.
// sklearn | neural_net | yolo | huggingface
public record CreateModelRequest(String title, String description, String modelType) {}
