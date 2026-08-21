# No-Code AI Development Platform

A production-grade, no-code machine learning platform built with a microservice architecture. Users design model configurations, upload datasets, train classical ML models, and view training history — all through a browser without writing code.

**Live:** [no-code-ai-development-platform.pages.dev](https://no-code-ai-development-platform.pages.dev)
**API:** [ai-dev-platform.duckdns.org](https://ai-dev-platform.duckdns.org)

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
| Backend | Java 21, Spring Boot 4, Spring Security, Spring Data JPA |
| ML Service | Python 3.12, FastAPI, scikit-learn, TensorFlow/Keras (planned) |
| Database | PostgreSQL (Supabase) |
| Cache / Queue | Redis 7 |
| Container | Docker, Docker Compose |
| Auth | JWT in httpOnly cookie (SameSite=None; Secure) |
| File Storage | Supabase Storage |
| Cloud | AWS EC2 (t3.micro, Ubuntu 24.04) |
| TLS | Nginx + Let's Encrypt (certbot) |
| DNS | DuckDNS (stable subdomain, Elastic IP) |
| CI/CD | GitHub Actions → Docker Hub → EC2 |

---

## Current Status

### ✅ Working
- **Go Gateway** — JWT middleware, API-key middleware for external callers, HTTP routing to Java and Python services, CORS, `GET /api/me` lightweight auth check
- **Java Spring Boot** — user registration/login (bcrypt + JWT, SameSite=None cookie for cross-origin), model CRUD, experiment history, API key issuing and verification
- **Python ML Service** — `/api/ml/train` (4 sklearn algorithms), predict by model id, model file stored in Supabase Storage
- **External model serving** — `/api/serve/*`, called with an API key from outside the browser
- **Redis** — running, wired to gateway
- **PostgreSQL (Supabase)** — users, models, model specs, experiments, api keys
- **Docker Compose** — all 4 services start with a single command
- **React + TypeScript frontend** — auth flow, My Models page, Process page (train + history + deploy + predict + API keys)
- **Production deployment** — AWS EC2 t3.micro, Nginx + Let's Encrypt, DuckDNS subdomain
- **CI/CD** — GitHub Actions: build → Docker Hub → EC2 restart on every push to main

### 📋 Planned
- Async training via Redis job queue (POST /train returns jobId, Python worker consumes)
- TensorFlow/Keras endpoint — accept layer config, train, stream epoch metrics via WebSocket
- YOLO service — image upload → object detection
- HuggingFace NLP — text classification, NER
- Kafka for event-driven notifications (model.trained topic)

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
POST /api/ml/train                   { model_type, dataset, target_column, hyperparameters?, test_size? }
POST /api/ml/models/:id/predict      { data }
```

**Supported `model_type` values:** `linear_regression`, `logistic_regression`, `random_forest_classifier`, `random_forest_regressor`

**Train response:**
```json
{
  "metrics": { "accuracy": 0.95 },
  "model_key": "models/<uuid>.joblib"
}
```

`model_key` is an object path in a private bucket, not a link. It is saved on the
experiment row and resolved server-side; predict names the *model*, so ownership can be
checked against something the client does not choose.

### Serving (external — API key required)

The only routes reachable without a browser session. Authenticated by an `X-API-Key`
header instead of the JWT cookie. A key is created in the UI on a model's page and
authorizes that one model — nothing else the user owns.

```
GET  /api/serve/schema     → { model_id, model_title, features }
POST /api/serve/predict    { data: [ { ...row... } ] }
```

The model is not named in the URL: the key already identifies exactly one, and it
resolves to whichever training run is currently deployed.

**Try it end to end**

1. Train a model, then press **Deploy** on a run under Training History.
2. Under **API Access**, create a key and copy it — it is shown once and stored only as
   a hash.
3. Ask the model what it expects, rather than guessing column names:

```bash
curl -H "X-API-Key: dlp_..." http://localhost:8080/api/serve/schema
# { "model_id": "...", "model_title": "Churn v2", "features": ["age", "income"] }
```

4. Send rows keyed by exactly those `features`:

```bash
curl -X POST http://localhost:8080/api/serve/predict \
  -H "X-API-Key: dlp_..." \
  -H "Content-Type: application/json" \
  -d '{"data": [{"age": 35, "income": 150.0}]}'
# { "predictions": [1.5], "model_id": "...", "model_title": "Churn v2" }
```

The response echoes the model it used, so the wrong key in the wrong script shows up as
a wrong title rather than as confident predictions from a model you did not mean.

| Status | Meaning |
|--------|---------|
| `400` | Columns don't match — the body lists `expected`, `received` and `missing` |
| `401` | No `X-API-Key` header, or no such key |
| `404` | No such model, or it isn't yours |
| `409` | The model exists but has no deployed version — deploy one |
| `503` | The key could not be verified right now. Your key is fine; do not rotate it |

Revoking is deleting the key in the UI, and takes effect on the next request. A lost key
cannot be recovered — delete it and create another.

> **Running this from a clone.** `docker compose up -d` starts *published* images, and CI
> pushes those only on `main`. On a feature branch the routes above will 404 until you
> rebuild the three services this feature touches:
>
> ```bash
> docker build -t plokoon68/ai-dev-platform-go-gateway:latest ./go-gateway
> docker build -t plokoon68/ai-dev-platform-java-service:latest ./java-service
> docker build -t plokoon68/ai-dev-platform-python-ml-service:latest ./python-ml-service
> docker compose up -d
> ```

---

## Key Design Decisions

**JWT in httpOnly cookie** — the cookie is set by Java (via Go Gateway), not readable by JavaScript. Prevents XSS-based token theft.

**Gateway injects X-User-ID header** — JWT is validated once at the gateway; downstream services read `X-User-ID` from the header instead of parsing JWT themselves. Java and Python never see the raw token.

**API keys are verified at the gateway, not in Python** — `RequireAPIKey` resolves the key to its owner and its one model by asking Java, then sets `X-User-ID` and `X-Model-ID` for downstream services. This keeps a single meaning for `X-User-ID` everywhere: always gateway-asserted, never self-declared, so every ownership check already in Java and Python keeps working unchanged. The cost is that external predictions now need Java on the request path — recorded in `planning/decisions.md`.

**A key authorizes one model, not one account** — handing a key to a contractor cannot leak the rest of your models, and revoking it cannot break your other integrations. Keys are 32 bytes of `SecureRandom` stored as SHA-256 under a unique index; the plaintext exists only in the response that creates it.

**Deployment is an explicit pointer** — `ml_models.deployed_experiment_id` names which training run answers requests. It used to be whichever completed run sorted first, which meant retraining silently changed what callers got. The first completed run auto-deploys so nothing regressed; every change after that is a button press.

**Supabase Session Pooler** — Supabase's direct connection endpoint is IPv6-only. Docker Desktop on Windows/Mac routes IPv4 only. The Session Pooler (PgBouncer) sits in front and provides an IPv4-accessible endpoint.

**`env_file` instead of `environment:` in docker-compose** — Docker Compose interpolates `$VAR` patterns when using the `environment:` key. Passwords containing `$` get silently mangled. `env_file:` passes values to the container literally, bypassing interpolation.

**ModelSpec versioning** — specs are immutable rows. Saving a new config creates a new row with `version + 1` and `is_active = true`; previous rows are set to `is_active = false`. Enables full config history without soft deletes.

**Python owns model file storage** — the trained model is serialized with joblib and uploaded to Supabase Storage by the ML service itself, which returns only an object path. The service that produces a file is the service that stores it: Java never handles file bytes, it just persists the path alongside the experiment row. Keeps large payloads off the Gateway and out of the database. The bucket is private, so the path is useless without the service key.

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
