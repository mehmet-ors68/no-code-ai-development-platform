package com.aiplatform.javaservice.dto;

import jakarta.validation.constraints.NotBlank;

// identifier can be email or username — backend tries both
public record LoginRequest(
        @NotBlank(message = "Username or email is required")
        String identifier,

        @NotBlank(message = "Password is required")
        String password
) {}
