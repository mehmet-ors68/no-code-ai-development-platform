# AI development Platform

A no-code machine learning platform built with a microservice architecture. Users design neural networks or run classical ML models through a visual interface — no code required.

Originally a custom C++ deep learning library (graduation project), now expanded into a production-grade, cloud-native platform.

---

## Architecture

```
React + TypeScript (Vite)  ←  http://localhost:5173
          │
     HTTP (all traffic)
          │
          ▼
  Go API Gateway  :8080        ←  Redis :6379
  ├── JWT validation                ├── rate limiting counters
  ├── rate limiting                 └── training job queue
  └── HTTP routing
          │
    ┌─────┴──────────────────────────┐
    │                                │
Java Spring Boot :8081      Python FastAPI :8000
├── POST /api/auth/register  ├── POST /api/ml/train
├── POST /api/auth/login     ├── POST /api/ml/predict
├── GET  /api/auth/logout    ├── POST /api/ml/keras/train  (planned)
├── /api/models  (CRUD)      ├── POST /api/ml/detect       (planned)
└── business logic           └── POST /api/ml/nlp          (planned)
          │
    Supabase PostgreSQL
    (via Session Pooler / IPv4)
```

**Why this architecture:**
- **Go Gateway** — single entry point; JWT validated once, not in every service; handles thousands of concurrent connections with goroutines
- **Java Spring Boot** — industry-standard for business logic and auth; Spring Security + JPA reduce boilerplate
- **Python FastAPI** — the ML ecosystem lives here; sklearn, TensorFlow, YOLO, HuggingFace all need Python
- **Redis** — rate limiting that works across multiple Gateway instances; training job queue for async model training
- **Supabase** — managed PostgreSQL with free tier; Session Pooler required for Docker/IPv4 environments

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| API Gateway | Go (Gin), JWT validation, Redis rate limiting |
| Backend | Java 21, Spring Boot 3, Spring Security, Spring Data JPA |
| ML Service | Python 3.12, FastAPI, scikit-learn, TensorFlow/Keras (planned) |
| Database | PostgreSQL (Supabase) |
| Cache / Queue | Redis 7 |
| Container | Docker, Docker Compose |
| Auth | JWT in httpOnly cookie |
| Storage | AWS S3 (planned) |

---

## Current Status

### ✅ Working
- **Go Gateway** — JWT middleware, HTTP routing to Java and Python services, CORS
- **Java Spring Boot** — user registration/login (bcrypt + JWT), model CRUD (create/list/update/delete), ModelSpec versioning (immutable config rows)
- **Python ML Service** — `/api/ml/train` (linear regression, logistic regression, random forest classifier/regressor), `/api/ml/predict`, model serialized as base64 pickle
- **Redis** — running, wired to gateway
- **PostgreSQL (Supabase)** — users, ml_models, model_specs tables live
- **Docker Compose** — all services start with a single command
- **React frontend** — Vite + TypeScript + shadcn/ui; auth flow (login/register), My Models page (CRUD)

### 🔧 In Progress
- React Process page — model training UI (layer designer for Keras, hyperparameter config for sklearn)

### 📋 Planned
- TensorFlow/Keras endpoint in Python — accept layer config as JSON, train, stream epoch metrics
- WebSocket proxy in Go Gateway — real-time training progress to React
- Redis job queue — async training; POST /train returns jobId, worker picks it up
- YOLO service — image upload → object detection
- HuggingFace NLP — text classification, NER
- AWS S3 — dataset and model file storage
- Docker Compose production config with environment-specific overrides

---

## Repository Layout

```
DL Public/
├── docker-compose.yml          # Orchestrates all services
├── .env                        # Secrets — GITIGNORED, never commit
│
├── go-gateway/                 # Go API Gateway
│   ├── main.go                 # Routes, CORS, server startup
│   ├── go.mod
│   ├── Dockerfile
│   └── internal/
│       ├── middleware/auth.go  # JWT validation → sets X-User-ID header
│       └── proxy/              # httputil.ReverseProxy to Java / Python
│
├── java-service/               # Spring Boot — auth + business logic
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/main/java/com/aiplatform/javaservice/
│       ├── controller/         # AuthController, ModelController
│       ├── entity/             # MlModel, ModelSpec, User
│       ├── repository/         # JPA repositories
│       └── security/           # JWT filter, Spring Security config
│
├── python-ml-service/          # FastAPI — ML inference and training
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── routers/
│       └── sklearn_router.py   # /train and /predict endpoints
│
├── view-vite/                  # React + TypeScript frontend (new)
│   ├── src/
│   │   ├── api/                # client.ts, auth.ts, models.ts
│   │   ├── components/ui/      # shadcn/ui: Button, Input, Card, Label
│   │   ├── context/            # AuthContext (authStatus state machine)
│   │   ├── pages/              # Landing, Login, Register, MyModels
│   │   └── types/              # Shared TypeScript interfaces
│   └── vite.config.ts
│
├── view/                       # React frontend (legacy JS — kept for reference)
│
├── c++-framework/              # Original C++ deep learning library (graduation project)
│   ├── Include/                # NeuralNetwork, Layer, Activation, Loss factories
│   ├── Src/
│   └── Dockerfile
│
└── server/                     # Node.js/Express (legacy — replaced by Java)
```

---

## Getting Started

### Prerequisites
- Docker Desktop
- Node.js ≥ 20 (frontend dev only)

### 1. Configure environment

Create `DL Public/.env` (never commit this file):

```env
JWT_SECRET=your_jwt_secret_here
DB_USERNAME=postgres.your_supabase_project
DB_PASSWORD=your_supabase_password
DATABASE_URL=jdbc:postgresql://aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require
```

> **Supabase note:** Use the Session Pooler URL (not the direct connection). Direct connections are IPv6-only and won't work inside Docker without additional configuration.

### 2. Start all backend services

```bash
cd "DL Public"
docker compose up --build
```

Services started:
| Service | Port | Health check |
|---------|------|--------------|
| Go Gateway | 8080 | `GET /healthz` |
| Java Spring Boot | 8081 | `GET /healthz` |
| Python FastAPI | 8000 | `GET /healthz` |
| Redis | 6379 | `redis-cli ping` |

### 3. Start the frontend (dev)

```bash
cd "DL Public/view-vite"
npm install
npm run dev
```

Open `http://localhost:5173`

---

## API Reference

All requests go through Go Gateway on port **8080**.

### Auth (public — no JWT required)

```
POST /api/auth/register   { username, email, password }
POST /api/auth/login      { username, password }        → sets httpOnly cookie
GET  /api/auth/logout
```

### Models (protected — JWT cookie required)

```
GET    /api/models          → list user's models
POST   /api/models          { name, description, modelType }
PUT    /api/models/:id      { name?, description?, status? }
DELETE /api/models/:id

GET    /api/models/:id/specs         → version history
POST   /api/models/:id/specs         { modelType, config, datasetPath }
```

### ML (protected)

```
POST /api/ml/train      { model_type, dataset, target_column, hyperparameters?, test_size? }
POST /api/ml/predict    { model_b64, data }
```

**Supported `model_type` values:** `linear_regression`, `logistic_regression`, `random_forest_classifier`, `random_forest_regressor`

**Train response:**
```json
{
  "metrics": { "accuracy": 0.95 },
  "model_b64": "<base64-encoded pickle — store this to call /predict later>"
}
```

---

## Key Design Decisions

**JWT in httpOnly cookie** — the cookie is set by Java (via Go Gateway), not readable by JavaScript. Prevents XSS-based token theft.

**Gateway injects X-User-ID header** — JWT is validated once at the gateway; downstream services read `X-User-ID` from the header instead of parsing JWT themselves. Java and Python never see the raw token.

**Supabase Session Pooler** — Supabase's direct connection endpoint is IPv6-only. Docker Desktop on Windows/Mac routes IPv4 only. The Session Pooler (PgBouncer) sits in front and provides an IPv4-accessible endpoint.

**`env_file` instead of `environment:` in docker-compose** — Docker Compose interpolates `$VAR` patterns when using the `environment:` key. Passwords containing `$` get silently mangled. `env_file:` passes values to the container literally, bypassing interpolation.

**ModelSpec versioning** — specs are immutable rows. Saving a new config creates a new row with `version + 1` and `is_active = true`; previous rows are set to `is_active = false`. Enables full config history without soft deletes.

**Python returns model as base64 pickle** — the ML service is stateless. The caller (React → Gateway → Python) receives the serialized model and decides where to store it (currently in-memory for demo; AWS S3 in roadmap). No server-side model state to manage.

---

## Frontend Architecture Notes

The React frontend (`view-vite/`) was migrated from CRA (JavaScript) to Vite (TypeScript) as part of this rebuild.

**Key improvements over the legacy frontend:**
- Single axios `client.ts` → Go Gateway (replaced `expressAPI` + `crowAPI`)
- `AuthStatus: 'loading' | 'authenticated' | 'unauthenticated'` replaces three boolean states
- `useAuth()` throws if called outside `<AuthProvider>` — caught at compile time
- `import.meta.env.VITE_*` env vars (Vite) instead of `process.env.REACT_APP_*` (CRA)
- shadcn/ui components: typed variants via `class-variance-authority`, no more ad-hoc className strings

---

## C++ Deep Learning Library (Original Graduation Project)

The `c++-framework/` folder contains the original custom deep learning library built from scratch in C++17:

- **Layers:** DenseLayer, ConvolutionalLayer
- **Activations:** ReLU, LeakyReLU, Sigmoid, Softmax, Tanh — via Factory pattern
- **Loss functions:** CategoricalCrossEntropy, SigmoidCrossEntropy — via Factory pattern
- **Utilities:** Initializer, Regularization, HyperParameterSearch, DatasetLoader, ModelEvaluator
- **API:** REST endpoints via Crow; live training metrics via WebSocket

This component is kept for reference. Its functionality is being migrated to the Python FastAPI service using TensorFlow/Keras — same feature set, GPU support, and a fraction of the code.
