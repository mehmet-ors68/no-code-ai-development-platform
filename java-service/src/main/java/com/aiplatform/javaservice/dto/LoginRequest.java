package com.aiplatform.javaservice.dto;

// identifier can be email or username — backend tries both
public record LoginRequest(String identifier, String password) {}
