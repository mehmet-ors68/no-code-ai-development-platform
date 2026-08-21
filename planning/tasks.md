# Tasks — external model access

The commit plan at the end of `spec.md`, broken into the work under each commit.
`[x]` shipped, `[ ]` did not. All seven shipped.

## 1. `docs(planning):` spec and decisions

- [x] `planning/spec.md` — data model, endpoints per service, response and error
      contract, frontend surface, commit plan
- [x] `planning/decisions.md` — thirteen decisions with what was rejected, plus the cut
      list

## 2. `feat(java):` deployment pointer

- [x] `deployedExperimentId` on `MlModel`, nullable, created by `ddl-auto: update`
- [x] `PUT /api/models/{id}/deployment` + `SetDeploymentRequest`
- [x] `GET /api/models/{id}/deployment` — one call per prediction; `404` not yours,
      `409` nothing deployed
- [x] auto-deploy in `saveExperiment` when a run completes and the model has no
      deployment yet, so today's implicit behaviour is not a regression
- [x] deleting the deployed experiment clears the pointer, and deploying a run without
      an artifact is refused — beyond the spec, so a non-null pointer always resolves to
      loadable bytes

## 3. `feat(java):` API keys

- [x] `ApiKey` entity + `ApiKeyRepository`: `key_hash` unique, `key_prefix`, `label`,
      `created_at`; owner reached through `model.userId`
- [x] `ApiKeyService` — `dlp_` + 32 bytes `SecureRandom` base64url, SHA-256 hex at rest,
      plaintext returned once
- [x] `POST /internal/api-keys/verify` (`InternalApiKeyController`) — key in the body,
      `200 {userId, modelId}` or `404`
- [x] `POST` / `GET` / `DELETE /api/models/{id}/api-keys` (`ApiKeyController`), ownership
      checked on every call
- [x] `deleteModel` deletes the model's keys first (decision 6) — no hand-applied cascade

## 4. `feat(go):` API-key entrance

- [x] `internal/middleware/apikey.go` — `401` on missing header or lookup miss; `503` on
      unreachable Java, 2s timeout, or an unparseable `200`; sets `userID` and `modelID`
- [x] `external` group in `main.go`: `POST /api/serve/predict`, `GET /api/serve/schema`
- [x] `proxy.To` deletes `X-User-ID`, `X-Model-ID`, `X-API-Key` before setting the first
      two — the raw key never travels past the gateway
- [x] `apikey_test.go` — six cases: no header, unknown key, Java 500, Java timeout,
      malformed `200`, happy path
- [x] `reverse_proxy_test.go` — three cases for header hygiene; beyond the spec
- [x] CORS left unchanged, so browser cross-origin calls to `/api/serve/*` fail preflight
      (decision 10)

## 5. `feat(ml):` serving

- [x] `prediction.py` — `run_prediction` and `model_schema` as the single place a
      prediction is produced, `_fetch_deployment`, `_load_model` under
      `@lru_cache(maxsize=4)` (decision 13)
- [x] `routers/serve_router.py` mounted at `/api/serve` in `main.py`
- [x] `POST /api/ml/models/{model_id}/predict` — model id from the path, identity from
      `X-User-ID`
- [x] `POST /api/ml/predict` deleted — it took a raw `model_key` with no ownership check
- [x] `400` on a column mismatch, listing `expected` / `received` / `missing`, instead of
      a `KeyError` surfacing as `500`

## 6. `feat(web):` deploy control

- [x] `types/index.ts` — `ApiKey`, `deployedExperimentId` on `MlModel`
- [x] `api/models.ts` — `deployExperiment`
- [x] `api/ml.ts` — `predictSklearn(modelId, rows)` posts to
      `/ml/models/{modelId}/predict`; the `model_key` parameter is gone
- [x] `pages/Process.tsx` — Deploy button per experiment row, non-interactive "Deployed"
      on the deployed one; Predict stays on this page

## 7. `feat(web):` API key management

- [x] `api/apiKeys.ts` — `fetchApiKeys`, `createApiKey`, `deleteApiKey`
- [x] `components/ApiKeysCard.tsx` — inline expanding card, no new UI primitive
- [x] plaintext key rendered once on create, with a copy button and plain copy saying
      this is the only time it is visible and the recovery is delete-and-recreate
- [x] existing keys listed by label, `dlp_a3f9…` prefix, created date, Delete

## Docs (spec § Docs)

- [x] `### Serving (external — API key required)` under the README's `## API Reference`,
      with an end-to-end example that reads its column names from `/api/serve/schema`
- [x] status table: `400`, `401`, `404`, `409`, `503`
- [x] stale-image warning naming the three changed services and the `docker build`
      commands; compose left pointing at published images (decision 11)

Two departures from the plan in the history: commits 6 and 7 landed as one `feat(web):`
commit, and the README landed as a final `docs:` commit rather than alongside each claim
it makes true.

## Unplanned, shipped

- [x] `.gitignore` now ignores `view-vite/dist/` — the Vite build output had never been
      ignored
- [x] doubled `/api` in the `ApiKeysCard` usage hint: `VITE_GATEWAY_URL` already ends in
      `/api`, so the card was telling callers to POST to `…/api/api/serve/predict`

## Not done

- [ ] Run the local stack end to end against every documented status code — checks 3 and
      9 in `manual-test-log.md`. `409` has no evidence behind it, and the browser predict
      path was never exercised after being repointed.
- [ ] A `go test ./...` step in the `build-go` CI job. The branch adds nine Go tests that
      CI never runs: `deploy.yml` builds the image and deploys, and nothing in it fails on
      a failing test.
- [ ] A one-time SQL backfill setting `deployed_experiment_id` for models trained before
      this branch. Auto-deploy only fires when a *new* run completes, so those models keep
      a hidden Predict panel until someone presses Deploy.

## Cut, from `decisions.md`

Known-remaining, not forgotten. Each is something production would want.

- [ ] Frozen model versions — pin a key to an experiment, or take a version in the request
- [ ] Key expiry and rotation — TTL, rotation, expiry warnings
- [ ] Rate limiting and quotas — per-key limits; the bounded model cache caps resident
      memory but nothing caps CPU or request volume
- [ ] `last_used_at` on keys — an async or sampled write, or usage read from logs
- [ ] Soft-delete / audit of revocations — an audit trail of who revoked what, when
- [ ] Caching verified keys — a short-TTL cache; Redis is already in compose and unused
- [ ] Python and Java tests — ownership and error-contract tests at every layer
- [ ] mTLS or a shared secret on `/internal/*` — an authenticated service-to-service hop
- [ ] Moving Predict to its own tab — pure reorganization
- [ ] Streaming or batch endpoints — batch upload, async jobs for large inputs
