# Spec — external model access

What gets built. The reasoning behind each choice is in `decisions.md`; the
problem statement is in `BRIEF.md`.

## Summary

A user who has trained a model can create an **API key** for it, hand that key to
a script or a backend job, and call the model over HTTP without a browser
session. The key authorizes exactly one model and nothing else. Revoking it is a
single delete.

Two entrances, one implementation. The browser keeps its cookie-authenticated
path; the outside world gets a key-authenticated path. They meet at one function
in Python, so there is one place where a prediction is actually produced.

```
browser  ──cookie──▶  gateway ─RequireAuth───▶  POST /api/ml/models/{id}/predict ─┐
                                                                                 ├─▶ _run_prediction()
script   ─X-API-Key─▶  gateway ─RequireAPIKey─▶  POST /api/serve/predict          ─┘
                          │
                          └──▶ java  POST /internal/api-keys/verify
```

## Data model

Two changes, both created automatically by `ddl-auto: update`. No hand-written
SQL, so a fresh clone gets a working database.

**`ml_models` gains one column.**

| column | type | note |
|---|---|---|
| `deployed_experiment_id` | `uuid` null | which trained artifact this model serves |

Nullable: a model with no completed run has nothing to deploy. This replaces the
implicit rule at `Process.tsx:187`, where the artifact was whichever completed
experiment happened to sort first.

**`api_keys` is new.**

| column | type | note |
|---|---|---|
| `id` | `uuid` pk | |
| `model_id` | `uuid` fk to `ml_models` | the one model this key authorizes |
| `key_hash` | `varchar(64)` unique | SHA-256 hex of the presented key |
| `key_prefix` | `varchar(16)` | `dlp_a3f9` — display only, so a user can tell keys apart |
| `label` | `varchar(100)` | user-supplied: "Zapier", "nightly job" |
| `created_at` | `timestamp` | |

The owning user is reached through `model.userId` rather than stored again on the
row. One foreign key already answers both "whose key is this" and "which model",
and a denormalized copy is a second source of truth that can drift.

Key format is `dlp_` + 32 bytes from `SecureRandom`, base64url — 47 characters
total. The plaintext is returned once, at creation, and never stored.

## Endpoints

### Java — `java-service`

| method | path | purpose |
|---|---|---|
| `POST` | `/internal/api-keys/verify` | body `{"key"}` returns `200 {"userId","modelId"}` or `404` |
| `POST` | `/api/models/{id}/api-keys` | body `{"label"}` returns `201` with the plaintext key, once |
| `GET` | `/api/models/{id}/api-keys` | list: id, label, keyPrefix, createdAt |
| `DELETE` | `/api/models/{id}/api-keys/{keyId}` | revoke |
| `PUT` | `/api/models/{id}/deployment` | body `{"experimentId"}` — sets the pointer |
| `GET` | `/api/models/{id}/deployment` | `200` deployed experiment, `404` not yours, `409` nothing deployed |

`/api/models/*` is already proxied by the gateway, so the four user-facing ones
need no gateway change. `/internal/*` is deliberately outside `/api/`: no gateway
route can reach it, from inside or out.

`GET /api/models/{id}/deployment` exists so Python makes **one** call per
prediction. Resolving the pointer from `GET /api/models/{id}` plus
`GET /api/models/{id}/experiments` would be two calls and two ownership checks
for one question.

`deleteModel` deletes the model's API keys before deleting the model. See
decision 6.

### Go — `go-gateway`

One new group. The existing `/api/ml/*path` wildcard already routes the browser
predict path, so it is not touched — and cannot be: registering
`/api/ml/models/:id/predict` next to the wildcard panics Gin at startup, in
either declaration order.

```go
external := r.Group("/")
external.Use(middleware.RequireAPIKey)
{
    external.POST("/api/serve/predict", proxy.To(pythonURL))
    external.GET("/api/serve/schema",  proxy.To(pythonURL))
}
```

`RequireAPIKey` reads `X-API-Key`, POSTs it to Java in a request body, and on
success sets `userID` and `modelID` in the Gin context. `401` on a miss, `503`
when Java cannot be reached.

`proxy.To` gains header hygiene: `Del` on `X-User-ID`, `X-Model-ID` and
`X-API-Key` before setting the first two. Today the `Set` calls mask an inbound
spoof only because every proxied route happens to overwrite them.

CORS is unchanged, which means browser cross-origin calls to `/api/serve/*` fail
preflight. That is the intent — see decision 10.

### Python — `python-ml-service`

`main.py` mounts a second router at `/api/serve`.

| method | path | identity from |
|---|---|---|
| `POST` | `/api/ml/models/{model_id}/predict` | `X-User-ID`, model id from path |
| `POST` | `/api/serve/predict` | `X-User-ID` + `X-Model-ID`, both from the gateway |
| `GET` | `/api/serve/schema` | same |

Both predict entrypoints are three lines and call `_run_prediction(model_id,
rows, user_id)`. `POST /api/ml/predict` — which took a raw `model_key` and ran it
with no ownership check at all — is **deleted**.

The load-by-path helper carries `@lru_cache(maxsize=4)`. Four is a
memory-pressure ceiling, not a speed setting — see decision 13.

## Response and error contract

Success, `POST .../predict`:

```json
{ "predictions": [], "model_id": "c81b-…", "model_title": "Churn v2" }
```

The model identity is echoed because the key alone names the model. Pasting the
wrong key into the wrong script would otherwise return confident predictions from
the wrong model, silently.

`GET /api/serve/schema` returns `{ "model_id", "model_title", "features" }`,
where `features` is the column list stored in the joblib payload at training time.

| status | when |
|---|---|
| `400` | request columns do not match `features` — response lists expected and received |
| `401` | `X-API-Key` missing, or no such key |
| `404` | model deleted, or the key's model is not the caller's — indistinguishable by design |
| `409` | model exists but has no deployed experiment |
| `503` | gateway could not reach Java to verify the key |

`400` matters more than it looks: today a column mismatch reaches
`pd.DataFrame(req.data)[payload["features"]]` and raises `KeyError`, which
surfaces as a 500. A caller error must not be reported as a server fault.

## Frontend

- `types/index.ts` — `ApiKey`; `deployedExperimentId` on `MlModel`.
- `api/ml.ts` — `predictSklearn(modelId, rows)` posts to
  `/ml/models/{modelId}/predict`. The `model_key` parameter is gone.
- `api/models.ts` — `deployExperiment`, `fetchApiKeys`, `createApiKey`,
  `deleteApiKey`.
- `pages/Process.tsx` — each experiment row gets a **Deploy** button; the
  deployed row shows a non-interactive "Deployed" state. The row and its action
  column already exist at `Process.tsx:499-540`. Predict stays on this page.
- `components/ApiKeysCard.tsx` — new. Inline expanding card, copying the pattern
  at `MyModels.tsx:119`; `components/ui/` has no dialog and this needs no new
  primitive. On create, the plaintext key renders in the card with a copy button
  and plain copy stating this is the only time it is visible and that the
  recovery is delete-and-recreate. Below it: label, `dlp_a3f9…`, created date,
  Delete.

### One thing I decided while drafting — say if you disagree

Gating predict on a *deployed* experiment changes existing behavior: today any
completed run is immediately predictable, and after this change a user would have
to click Deploy first. To keep that from being a regression, `saveExperiment`
sets `deployedExperimentId` when a run completes and the model has no deployment
yet. The first completed run auto-deploys, exactly matching today's implicit
behavior; every subsequent change is explicit.

## Test

`go-gateway/internal/middleware/apikey_test.go`, using stdlib `testing` and
`net/http/httptest` — no new dependencies. Cases: no header; unknown key (Java
404); Java 500; Java timeout; and the happy path, asserting `X-User-ID` and
`X-Model-ID` are set and `X-API-Key` is stripped.

Python and Java ship untested. That is on the cut list, not an oversight.

## Docs

A `### Serving (external — API key required)` subsection under the README's
existing `## API Reference`, which is already organized by trust level. One
end-to-end example: create a key in the UI, `curl /api/serve/schema` to learn the
columns, `curl /api/serve/predict`. The example reads its column names from the
schema response rather than hardcoding them, so it stays true whatever dataset
the reader trained on.

Plus a **stale image warning**. `.github/workflows/deploy.yml` builds and pushes
`:latest` only on `push: branches: [main]`, so a reader who clones this branch
and runs `docker compose up -d` gets images without this feature and concludes it
is broken. The note names the three changed services and gives the `docker build`
commands. Compose is not switched to `build:` — see decision 11.

## Commits

Planning first, so the history reads as decided-then-built. The only hard
ordering constraint is that the deployment pointer must exist before Python can
resolve it.

1. `docs(planning):` spec and decisions
2. `feat(java):` `deployedExperimentId`, deployment endpoints, auto-deploy first run
3. `feat(java):` `ApiKey` entity, verify endpoint, key CRUD, key cleanup in `deleteModel`
4. `feat(go):` `RequireAPIKey`, external route group, proxy header hygiene, middleware test
5. `feat(ml):` `/api/serve/predict`, `/api/serve/schema`, model-scoped UI predict, delete `/api/ml/predict`
6. `feat(web):` Deploy buttons, repointed predict
7. `feat(web):` `ApiKeysCard`

README changes land with the commit that makes each claim true.
