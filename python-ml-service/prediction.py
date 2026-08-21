import io
import os
from functools import lru_cache

import joblib
import pandas as pd
import requests as req_lib
from fastapi import HTTPException

from storage import get_supabase

BUCKET = "ml-models"

JAVA_SERVICE_URL = os.environ.get("JAVA_SERVICE_URL", "http://java-service:8081")


def _fetch_deployment(model_id: str, user_id: str) -> dict:
    """Ask Java which artifact this model serves, relying on ITS ownership check.

    Same shape as _fetch_owned_dataset: Java answers 403 for someone else's model and
    404 for one that doesn't exist, and both collapse to 404 here so a caller can't
    tell "exists but isn't yours" from "doesn't exist".

    One call, not two. Java returns the model title and the artifact path together
    because resolving them separately would mean two round trips and two ownership
    checks to answer a single question on the request path.
    """
    resp = req_lib.get(
        f"{JAVA_SERVICE_URL}/api/models/{model_id}/deployment",
        headers={"X-User-ID": user_id},
        timeout=10,
    )
    if resp.status_code == 409:
        # Deliberately distinguishable from 404: the caller owns this model, it just has
        # nothing deployed. "Deploy a version" is actionable; a 404 would send them
        # hunting for a model that is right there.
        raise HTTPException(status_code=409, detail="Model has no deployed version")
    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Model not found")
    return resp.json()


@lru_cache(maxsize=4)
def _load_model(model_key: str) -> dict:
    """Download and deserialize a trained artifact, keeping a few resident.

    maxsize is a memory ceiling, not a speed setting. The deployment box runs near its
    limit with no swap and a pickled forest is tens of megabytes, so raise this only
    with headroom to spare. It also bounds what a caller in a loop can allocate:
    loading per request had no ceiling at all.

    Invalidation is free — every training run writes a new models/<uuid>.joblib path, so
    redeploying changes the cache key rather than staling an entry. The payload is
    treated as read-only: predict and inverse_transform mutate nothing, so one entry is
    safe to share across the threadpool.
    """
    try:
        model_bytes = get_supabase().storage.from_(BUCKET).download(model_key)
        return joblib.load(io.BytesIO(model_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load model: {e}")


def run_prediction(model_id: str, rows: list[dict], user_id: str) -> dict:
    """The one place a prediction is produced. Both doors — browser cookie and API
    key — arrive here having proved who they are; neither gets its own copy of the
    ownership rule."""
    if not rows:
        raise HTTPException(status_code=400, detail="No rows to predict")

    deployment = _fetch_deployment(model_id, user_id)
    payload = _load_model(deployment["modelFilePath"])
    features = payload["features"]

    df = pd.DataFrame(rows)
    missing = [c for c in features if c not in df.columns]
    if missing:
        # Behind the browser form this reached pandas and raised KeyError, surfacing as a
        # 500 for what is squarely a caller error. A wrong column name is the single most
        # likely bad request an external API will ever see, so it gets a real answer.
        raise HTTPException(
            status_code=400,
            detail={
                "message":  "Input columns do not match the model's features",
                "expected": features,
                "received": list(df.columns),
                "missing":  missing,
            },
        )

    model = payload["model"]
    le    = payload["label_encoder"]

    # Reindexed to training order: a caller sending the right columns in the wrong order
    # would otherwise get silently wrong numbers.
    preds = model.predict(df[features])
    if le is not None:
        preds = le.inverse_transform(preds)

    # The model identity is echoed because an API key names the model on the caller's
    # behalf. Without it, the wrong key in the wrong script returns confident predictions
    # from the wrong model and nothing in the response says so.
    return {
        "predictions": preds.tolist(),
        "model_id":    deployment["modelId"],
        "model_title": deployment["modelTitle"],
    }


def model_schema(model_id: str, user_id: str) -> dict:
    """What to send. A caller holding only a key has no other way to learn the column
    names, and hardcoding them in the docs would only be true for one dataset."""
    deployment = _fetch_deployment(model_id, user_id)
    payload = _load_model(deployment["modelFilePath"])

    return {
        "model_id":    deployment["modelId"],
        "model_title": deployment["modelTitle"],
        "features":    payload["features"],
    }
