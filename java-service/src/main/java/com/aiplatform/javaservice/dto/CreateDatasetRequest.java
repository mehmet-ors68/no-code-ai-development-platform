package com.aiplatform.javaservice.dto;

import java.util.List;

// Sent by python-ml-service after it has uploaded the CSV to Supabase Storage.
// No userId field — that comes from the X-User-ID header, never from the body.
public record CreateDatasetRequest(
    String name,
    Integer rowCount,
    Integer columnCount,
    List<String> columns,
    String fileUrl
) {}
