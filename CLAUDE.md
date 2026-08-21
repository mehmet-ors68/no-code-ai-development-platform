# No-Code AI Development Platform

A web platform for training and using classical ML models without writing code:
upload a tabular dataset, pick a model type, set hyperparameters, train, predict.

## Services

| Service | Stack | Owns |
|---|---|---|
| `go-gateway` | Go, Gin | Single entry point. JWT auth, CORS, proxying. Sets `X-User-ID` for downstream services. |
| `java-service` | Spring Boot, JPA/Hibernate, Supabase Postgres | Auth (register/login, JWT issuing) and all relational metadata: `User`, `MlModel`, `ModelSpec`, `Dataset`, `Experiment`. |
| `python-ml-service` | FastAPI, scikit-learn, pandas | Training, prediction, and dataset/model file handling in Supabase Storage. |
| `view-vite` | React, TypeScript, Vite, Tailwind | UI. Talks only to the gateway, never to a service directly. |
| `redis` | — | Present in compose. |

Persistence is **Supabase**: Postgres for rows (via Java/JPA), Storage buckets for
files (via Python). There is no MongoDB in this project.

## Routing

The gateway is the contract. `go-gateway/main.go`:

- `/api/auth/*` — public, proxied to Java
- everything else under `protected` — JWT required, then proxied:
  - `/api/models/*`, `/api/datasets/*`, `/api/process/*` → Java
  - `/api/ml/*` → Python (**wildcard: a new Python route needs no gateway change**)

The frontend deliberately uses two prefixes for datasets: metadata reads go to
`/datasets` (Java), anything touching the stored file goes to `/ml/datasets`
(Python). The frontend never learns which service serves what.

## Key files

- `go-gateway/main.go` — route table, CORS allow-list, trusted proxies
- `go-gateway/internal/middleware/` — `RequireAuth`
- `java-service/src/main/java/com/aiplatform/javaservice/` — `controller/`, `model/`, `repository/`, `service/JwtService.java`, `config/SecurityConfig.java`
- `python-ml-service/routers/sklearn_router.py` — `/train`, `/predict`, `_build_model`, `_evaluate`
- `python-ml-service/routers/dataset_router.py` — upload/download/delete, `_fetch_owned_dataset` (ownership check — reuse it, don't rewrite it)
- `python-ml-service/storage.py` — `get_supabase()`
- `view-vite/src/api/` — one module per resource, all through the shared axios `client`
- `view-vite/src/pages/` — `Process.tsx` (train/test), `MyModels.tsx`, `Datasets.tsx`

## Supported models

`_build_model` in `sklearn_router.py` supports exactly four types:
`linear_regression` (no hyperparameters), `logistic_regression` (`max_iter`),
`random_forest_classifier` and `random_forest_regressor` (`n_estimators`,
`max_depth`). Adding a type means touching that function and the frontend form.

## Running locally

**`docker compose up -d` builds nothing.** Every service points at a published image
(`plokoon68/ai-dev-platform-*`), so the stack starts the last version CI pushed to Docker
Hub, not your working tree. Editing Go, Java or Python code and running `up -d` changes
nothing.

To run a service you are editing, run it directly against the rest of the stack:

```bash
cd go-gateway        && go run main.go                          # :8080
cd java-service      && ./mvnw spring-boot:run                  # :8081
cd python-ml-service && uvicorn main:app --reload --port 8000   # :8000
cd view-vite         && npm install && npm run dev              # :5173
```

Or rebuild that one image by hand before starting the stack:

```bash
docker build -t plokoon68/ai-dev-platform-go-gateway:latest ./go-gateway
docker compose up -d go-gateway
```

The frontend reads `VITE_GATEWAY_URL`. `.env` points at a local gateway; `.env.local`
(gitignored, and read first by Vite) can override it to hit the deployed one. Vite reads
env files at startup only — restart the dev server after changing either.

Secrets come from `.env`, which is gitignored and must never be committed.

## Conventions

- **Comments explain why, not what.** The existing ones name the specific failure
  they prevent (nginx body caps, axios overwriting a multipart boundary, a private
  bucket breaking a public URL fetch). Match that register; do not add narration.
- Conventional commits with a scope: `feat(ml):`, `fix(web):`, `refactor(ml):`,
  `docs(planning):`.
- Python private helpers take a leading underscore.
- Ownership is enforced server-side on every resource access. Never trust an ID
  from the client without checking the owner.
- Storage buckets are private. Files are read server-side with the service key;
  the browser gets a short-lived signed URL when it needs one.
- No new dependency without a reason worth writing down.
- **Check current docs before writing against a library API.** This repo pins
  specific versions of Gin, FastAPI, supabase-py, scikit-learn, axios and Spring
  Boot, and their surfaces move. When adding or changing a call into any of
  them, consult Context7 for the current signature rather than relying on
  recall. Skip it for code that only touches this repo's own functions.
