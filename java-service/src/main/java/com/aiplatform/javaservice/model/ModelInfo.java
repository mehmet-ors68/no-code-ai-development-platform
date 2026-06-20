package com.aiplatform.javaservice.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

// Node.js equivalent: modelInfoSchema in modelInfoModel.js
// Embedded classes (Layer, Parameters, etc.) mirror the sub-schemas
@Data
@Document(collection = "modelInfo")
public class ModelInfo {
    @Id
    private String id;
    private String modelId;
    private List<Layer> layers;
    private List<Parameters> parameters;
    private NormalizerParameters normalizerParameters;
    private int inputSize;
    private TrainingHyperparameters trainingHyperparameters;
    private boolean isCompiled = true;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @Data
    public static class Layer {
        private String activation;
        private int numOfNeurons;
        private double lr;
        private String wim;
        private String layerType;
    }

    @Data
    public static class Parameters {
        private List<List<Double>> weights;
        private List<Double> biases;
    }

    @Data
    public static class NormalizerParameters {
        private List<Double> means;
        private List<Double> stdevs;
    }

    @Data
    public static class TrainingHyperparameters {
        private String lossFunction;
        private String optimizer;
        private int epochNum;
        private int minibatchSize;
    }
}
