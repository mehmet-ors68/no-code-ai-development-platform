# Manual test log — external model access

Python and Java ship untested on this branch (decision 12). The only automated test
covers the gateway: `RequireAPIKey` and `proxy.To`, which is the trust boundary and
nothing below it. Everything else was checked by hand against a running stack, and this
file is the record of it — what was run, what was expected, what came back.

**Every API key here is truncated to its first eight characters.** This repository and
the session transcript are public; no full key appears in either.

## Two checks were not run

**Check 9 — a key whose model has no deployed experiment. Cut for time.** It would have
proved that a key which authenticates correctly against a model with nothing deployed
gets a `409`, distinguishable from a `404`: the caller is told to deploy a version,
rather than sent hunting for a model that is right there. `409` is the one status in the
serving contract with no evidence behind it.

**Check 3 — predict from the browser, via `POST /api/ml/models/{id}/predict`. Also not
run, and not a footnote to check 9.** It is the browser half of the same shared
`run_prediction`; checks 4, 5 and 8 exercise the API half. That is suggestive, not
proof — the UI path has its own request shape (axios client, `RequireAuth`, the
`/api/ml/*` wildcard, model id from the path) and none of it was exercised.

---

### 1. Gateway tests

- **Run** — `go test ./...` in `go-gateway`
- **Expected** — pass
- **Actual** — pass. `ok dl-platform/gateway/internal/middleware`,
  `ok dl-platform/gateway/internal/proxy` (nine tests; the root package has no test
  files).

### 2. Deploy from the UI

- **Run** — Process page, Training History, pressed **Deploy** on experiment #3
  (`PUT /api/models/{id}/deployment`)
- **Expected** — the row switches to a non-clickable "Deployed" state
- **Actual** — row shows "Deployed"; the button is gone, not disabled. No response body
  captured — this was a UI action.

### 3. Predict from the UI — **NOT RUN**

- **Would have run** — the Predict panel on the Process page, against
  `POST /api/ml/models/{id}/predict`
- **Expected** — `200` with predictions for the deployed experiment
- **Actual** — **not run.** See the note at the top: this is the browser half of the code
  path that checks 4, 5 and 8 exercise from the API side, and it has no evidence of its
  own.

### 4. Schema with a valid key

- **Run** — `curl -H "X-API-Key: dlp_vlFX…" http://localhost:8080/api/serve/schema`
- **Expected** — `200`
- **Actual** — `200`

```json
{"model_id":"7a51b5ab…","model_title":"test","features":["Pclass","Sex","Age","SibSp","Parch","Fare","Embarked_C","Embarked_Q"]}
```

### 5. Predict with a valid key

- **Run** —

```bash
curl -X POST http://localhost:8080/api/serve/predict \
  -H "X-API-Key: dlp_vlFX…" -H "Content-Type: application/json" \
  -d '{"data":[{"Pclass":3,"Sex":0,"Age":22,"SibSp":1,"Parch":0,"Fare":7.25,"Embarked_C":0,"Embarked_Q":0}]}'
```

- **Expected** — `200`
- **Actual** — `200`

```json
{"predictions":[1],"model_id":"7a51b5ab…","model_title":"test"}
```

The echoed `model_id` and `model_title` match the key's model, which is the point of
echoing them.

### 6. Schema with no key

- **Run** — `curl http://localhost:8080/api/serve/schema` (no `X-API-Key` header)
- **Expected** — `401`
- **Actual** — `401`. Rejected at the gateway; Java was never called.

```json
{"message":"Missing X-API-Key header"}
```

### 7. Schema with an unknown key

- **Run** — `curl -H "X-API-Key: dlp_0000…" http://localhost:8080/api/serve/schema`
- **Expected** — `401`
- **Actual** — `401`

```json
{"message":"Invalid API key"}
```

### 8. Predict with wrong columns

- **Run** —

```bash
curl -X POST http://localhost:8080/api/serve/predict \
  -H "X-API-Key: dlp_vlFX…" -H "Content-Type: application/json" \
  -d '{"data":[{"age":35,"income":150.0}]}'
```

- **Expected** — `400`, not the `500` this used to produce via `KeyError` in pandas
- **Actual** — `400`, with `expected`, `received` and `missing` all populated

```json
{"detail":{"message":"Input columns do not match the model's features","expected":["Pclass","Sex","Age","SibSp","Parch","Fare","Embarked_C","Embarked_Q"],"received":["age","income"],"missing":["Pclass","Sex","Age","SibSp","Parch","Fare","Embarked_C","Embarked_Q"]}}
```

### 9. Key for a model with no deployed experiment — **NOT RUN, cut for time**

- **Would have run** — create a key on a model that has never been deployed, then
  `curl -H "X-API-Key: dlp_…" http://localhost:8080/api/serve/schema`
- **Expected** — `409 {"detail":"Model has no deployed version"}`, distinct from the
  `404` returned for a model that is missing or not the caller's
- **Actual** — **not run.** `409` is the only documented status in the serving contract
  with nothing behind it in this log.

### 10. Java down

- **Run** — `docker compose stop java-service`, then
  `curl -i -H "X-API-Key: dlp_vlFX…" http://localhost:8080/api/serve/schema`
- **Expected** — `503`, not `401` (decision 7: a `401` here tells the caller to rotate a
  key that was never bad)
- **Actual** — `503`

```json
{"message":"Key verification unavailable"}
```

- **Recovery verified** — `docker compose start java-service`, then the same request
  returned `200` with the check 4 body again. The `503` was the outage, not a
  self-inflicted broken state.
