# Handoff brief — external model access

Entry point for any agent session working on this feature. It states the
problem, the constraints, and what already exists in the codebase. It does
**not** contain the design — that is worked out in the planning session and
recorded in `spec.md` and `decisions.md`.

## Working boundary

Work only inside this repository. Do not read files in parent directories.

## The problem

Someone trains a model on this platform and it works. Then they want to use it
from their own application — a script, a backend job, a spreadsheet tool — and
there is no way to. The model is reachable only by being logged into this web
UI and clicking through the predict page.

So the platform can produce a useful model and then strands it.

## Constraints

- **One feature.** Nothing else in the product changes: not training, not
  datasets, not the model list.
- **Time budget: roughly one working day**, including planning, review, and
  documentation. Design for that, and say out loud what gets cut.
- **It has to be understandable by someone who has never seen this repo.**
  A reader should be able to clone it, read the README, and try the feature.
- **It has to be safe to expose.** Whatever this opens up is reachable from
  outside the browser session, so the trust boundary has to be deliberate.
- This session's transcript will be published in a public repository.

## What already exists

Read these before proposing anything — most of the machinery is here.

- `python-ml-service/routers/sklearn_router.py` — `train` and `predict`.
  `predict` already loads a model from Supabase Storage by its `model_key` and
  runs it. Four model types are supported; see `_build_model`.
- `python-ml-service/routers/dataset_router.py` — `_fetch_owned_dataset`
  enforces that a resource belongs to the caller. Reuse it, don't rewrite it.
- `python-ml-service/storage.py` — `get_supabase()`, the shared Supabase client.
- `go-gateway/main.go` — the route table. Two modes today: public
  (`/api/auth/*`) and JWT-protected (everything else, with `X-User-ID` set for
  downstream services). `/api/ml/*` is a wildcard proxy to Python, so a new
  Python route needs no gateway change — but note that anything requiring a
  JWT is, by definition, browser-only.
- `java-service` — Spring Boot + JPA over Supabase Postgres. Owns users, model
  metadata, datasets, experiments.
- `view-vite/src/pages/` — `Process.tsx` is the train/predict page,
  `MyModels.tsx` the list.

## Open questions for the planning session

These are genuinely undecided. Grill me on them.

- Who is the user of this — the same person who trained the model, or someone
  they hand access to? That changes what has to be revocable.
- How does a caller with no browser session prove who they are, and where does
  whatever proves it get stored?
- What is the smallest surface that can be exposed without opening anything
  else in the platform?
- What does a caller see when their credentials are wrong, or right but for a
  different model?
- What is deliberately left out at this time budget, and what would production
  need before this could be turned on for real?

## Conventions

- Branch `feat/model-serving-api`. Never commit to `main`.
- Conventional commits with a scope: `feat(ml):`, `feat(web):`, `fix(go):`,
  `docs(planning):`. One commit per coherent unit of work — the history should
  read as a narrative of how the feature was built.
- Ownership is enforced server-side on every access. Never trust an ID from the
  client.
- Comments explain why, naming the specific failure they prevent. Match the
  register of the existing code; do not add narration.
