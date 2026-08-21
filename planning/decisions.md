# Decisions — external model access

Why the design in `spec.md` looks the way it does. Each entry records what was
decided, what it costs, and what was rejected. Alternatives are named because the
rejected ones are the interesting part.

---

## 1. A key authorizes one model, not one account

The brief asked whether the caller is the trainer or someone they hand access to.
That turned out to be a documentation question, not a code question. The code
question is scope.

An account-scoped key hands a contractor every model you will ever train, and
revoking it breaks your own integrations at the same time. A model-scoped key
makes "my own script" and "someone I delegated to" the same case, needs no extra
machinery for delegation, and makes revocation precise.

**Decided:** keys belong to a model. A user can hold several per model, labelled.

**Consequence:** a caller who needs two models needs two keys and two requests.
Acceptable — nothing in the product composes models today.

---

## 2. Opaque random key hashed at rest, not a JWT

Rejected: a long-lived JWT signed with the existing `JWT_SECRET`. It needs no
storage, but it cannot be revoked without a blocklist table — which is the same
table as this one, with worse properties, because a revoked JWT stays valid
anywhere the blocklist is not consulted.

Rejected: HMAC request signing. Replay-resistant and correct, and far more than a
day of work on both ends, including for every caller.

**Decided:** `dlp_` + 32 bytes of `SecureRandom`, base64url. Stored as SHA-256
hex under a unique index; verified by hashing the presented key and looking it up.

**On not using bcrypt:** bcrypt exists to make guessing *low-entropy* human
passwords expensive. This secret carries 256 bits of entropy, so there is nothing
to slow down, and bcrypt would turn one indexed lookup into a scan-and-compare
across every row.

---

## 3. The gateway verifies the key, calling Java

Rejected: Python verifies, with the gateway proxying a public path straight
through. It keeps the gateway free of database work, but it creates a second
trust boundary and a route where `X-User-ID` is self-derived rather than
gateway-asserted. Every ownership check downstream assumes that header came from
the gateway. Splitting that invariant means the next person adding a route has to
know which kind they are writing.

**Decided:** `RequireAPIKey` in the gateway, mirroring `RequireAuth`. One trust
boundary, one meaning for `X-User-ID`.

**Consequence, recorded as a real cost:** today a prediction needs Python and
Supabase. After this, every *external* prediction also needs Java up, on the hot
path, with no cache. Java becomes a hard dependency of a request path that did
not have one. Production would cache verified keys with a short TTL; this does
not.

---

## 4. The key alone identifies the model — no id in the URL

`POST /api/serve/predict` carries no model id. The key resolves to exactly one
model, so a path parameter would be redundant, and the redundancy could only ever
disagree with the key.

This dissolves one of the brief's questions rather than answering it: "right
credentials, wrong model" cannot happen, so there is no status code for it.

**Consequence:** the failure this trades into is a user pasting the wrong key
into the wrong script and getting confident predictions from the wrong model —
silent wrong answers, the worst failure mode in ML. Mitigated by echoing
`model_id` and `model_title` in every response, which is cheaper than a required
path parameter and visible in logs.

---

## 5. Deployment is an explicit pointer, not "the latest run"

Today `Process.tsx:187` picks `experiments.find(e => e.status === 'completed' &&
e.modelFilePath)` — the newest completed run, by an implicit rule nobody chose.
Exposing that externally would mean retraining silently changes what an outside
caller gets.

Rejected: `isDeployed` boolean on `experiments`. `Experiment.java:13` states the
entity is *"Immutable — never updated after creation"*, and nothing would stop
two rows being true at once.

Rejected: a `deployments` table with history and rollback. The production answer;
more than a day.

**Decided:** `deployed_experiment_id` on `ml_models`. One deployment per model,
enforced by the schema.

**Stated property, not an accident:** a key survives redeployment and starts
answering from the new artifact. That is what deploy means. A caller who needs a
frozen version does not have one — see cut list.

---

## 6. Model deletion removes its keys in code, not by database cascade

`ModelController:109` deletes a model and relies on `ON DELETE CASCADE` that was
applied to Postgres by hand — `MlModel` has no `@OneToMany` anywhere. Under
`ddl-auto: update`, the new `api_keys` foreign key is created with the default
`NO ACTION`, so once a model had a key, deleting that model would start failing
with a constraint violation. A feature that quietly breaks model deletion is
exactly what "one feature, nothing else changes" was meant to prevent.

Rejected: adding the cascade by hand in Supabase. It works, and it is invisible
to anyone reading the repository, and a fresh clone would not have it.

**Decided:** `deleteModel` deletes the model's keys before the repository call.
One line, visible in code, works on an empty database with no out-of-band SQL.

---

## 7. `503`, not `401`, when Java cannot be reached

When the verify hop fails, the gateway cannot distinguish a good key from a bad
one. Returning `401` asserts something it does not know, and it is actively
harmful: it tells a caller to rotate a key that was never bad. Anyone who
automated that rotation turns an outage into a stampede of key regeneration.

**Decided:** fail closed on identity, honest about cause. `401` only on an actual
lookup miss; `503` when Java is unreachable or times out. Timeout 2s.

---

## 8. `/internal/*` is protected by network isolation alone — a known boundary

`SecurityConfig` is `anyRequest().permitAll()`; Spring authorizes nothing,
because JWT validation happens in the gateway. So `/internal/api-keys/verify` is
guarded by exactly two things: every backend port in `docker-compose.yml` is
bound to `127.0.0.1`, and no gateway route proxies a path outside `/api/`.

That holds for a single-host compose deployment. It stops holding the moment
these services share a network with anything else — another tenant, a sidecar, a
misconfigured overlay — at which point anything on that network can mint identity
by asking Java to verify keys, or worse.

**Recorded as a known boundary, not an assumption.** Production wants a shared
secret or mTLS on that hop. The key is sent in a POST body rather than a URL path
so it does not land in access logs along the way, but that is hygiene, not
authorization.

---

## 9. `proxy.To` deletes identity headers before setting them

`proxy.To` calls `Header.Set("X-User-ID", …)` only when `userID != ""`, and never
deletes an inbound one. Today that is masked, because every proxied route sets
the header. The new group makes it load-bearing.

**Decided:** unconditionally `Del` `X-User-ID`, `X-Model-ID` and `X-API-Key`
before setting the first two. The raw secret never travels past the gateway —
Python has no use for it, and forwarding credentials deeper is how they end up in
a log nobody audits.

**Header named `X-API-Key`, not `Authorization`:** it is not a bearer JWT, and
conflating the two invites the wrong mental model in every client that reads the
docs.

---

## 10. No CORS for `/api/serve/*`

The CORS allow-list is unchanged, so a browser cross-origin call to
`/api/serve/*` fails preflight. This is deliberate: a key in frontend JavaScript
is a published key. `curl` and server-side callers send no `Origin` and are
unaffected.

Costs nothing to implement — it is the existing middleware doing what it already
does — but it is a decision, not an oversight, and would be wrong to "fix" later
without thinking about it.

---

## 11. Compose keeps pointing at published images

`docker compose up -d` builds nothing; every service runs the last image CI
pushed. CI pushes only on `push: branches: [main]`. So a reader who clones this
branch and follows the README gets a stack without this feature.

Rejected: switching compose to `build:`. It would make the README work, at the
cost of diverging from how this actually deploys. Changing production's shape to
make a document easier is the wrong trade.

**Decided:** the README says so plainly and gives the three `docker build`
commands.

---

## 12. One test, in Go

There is no test infrastructure in this repository to extend: no pytest, no
`_test.go`, and Java has only the Spring context-load test. So "add tests" means
building infrastructure, and the budget buys roughly one.

The thing that must hold is that the gateway fails closed. A Go middleware test
covers exactly that boundary and needs **zero new dependencies** — `testing` and
`net/http/httptest` are stdlib and gin is already required. A pytest suite would
mean a new dev dependency, which CLAUDE.md asks be justified in writing, to test
a layer that is not the trust boundary.

**Decided:** `apikey_test.go` against an `httptest` fake Java. Python and Java
untested, on the cut list.

---

## 13. Model loading is cached, and the cache is small on purpose

`_run_prediction` resolves a `modelFilePath` and downloads the joblib from
Supabase on **every** call. Under a browser form that is a click; under an API
key it is whatever the caller's loop does.

**Decided:** `@lru_cache(maxsize=4)` on the load-by-path helper.

**The rationale is memory, not speed.** The deployment box runs near its memory
ceiling with no swap, and a pickled forest is tens of megabytes. Four is a
memory-pressure knob, not a performance tuning parameter, and it should only be
raised with headroom to spare — raising it on a box that is already tight trades
a slow endpoint for an OOM kill.

**It also narrows the exhaustion vector** named in the rate-limiting cut-list
row. Loading per call gives an attacker unbounded allocation; a bounded cache
gives a predictable ceiling of four resident models regardless of request rate.
That is a smaller hole, not a closed one — rate limiting is still cut.

**Invalidation is free.** Every training run writes a new `models/{uuid}.joblib`
path, so a redeploy changes the cache key rather than staling an entry. There is
no path by which the bytes behind a given key can change.

The cached payload is read-only in use — `predict` and `inverse_transform`
mutate nothing — so sharing one entry across FastAPI's threadpool is safe.

---

## Cut list

Deliberately not built, at roughly one working day. Each of these is a thing
production would want.

| Cut | Why it is safe for now | What production needs |
|---|---|---|
| Frozen model versions | Redeployment changing the served artifact is what deploy means (decision 5) | Pin a key to an experiment, or a version in the request |
| Key expiry and rotation | Nothing rotates it, so `expires_at` would be a column that only ever lies | TTL, rotation, expiry warnings |
| Rate limiting and quotas | Loopback-bound ports, a single trusted user during the exercise, and a bounded model cache capping resident memory (decision 13) | Per-key limits — a bounded cache caps memory but nothing caps CPU or request volume |
| `last_used_at` on keys | A database write on the hot path of every prediction, for a cosmetic field | Async or sampled write, or usage from logs |
| Soft-delete / audit of revocations | Revocation is a `DELETE`, leaving nothing to filter on | An audit trail of who revoked what, when |
| Caching verified keys | Correctness first; the hop is on the Docker network | Short-TTL cache — Redis is already in compose and unused |
| Python and Java tests | The Go test covers the trust boundary (decision 12) | Ownership and error-contract tests at every layer |
| mTLS or a shared secret on `/internal/*` | Network isolation on a single host (decision 8) | Authenticated service-to-service hop |
| Moving Predict to its own tab | Pure reorganization; buys the feature nothing | — |
| Streaming or batch endpoints | One request, one JSON array | Batch upload, async jobs for large inputs |
