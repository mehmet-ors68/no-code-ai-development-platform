package com.aiplatform.javaservice.dto;

// Java record: immutable DTO — constructor, getters, equals, toString otomatik
// Node.js'te: const { email, password, name } = req.body
public record RegisterRequest(String username, String email, String password, String name) {}
