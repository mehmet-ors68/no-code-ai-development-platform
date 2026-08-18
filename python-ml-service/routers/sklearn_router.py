import io
import uuid
import joblib

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_squared_error, r2_score
from sklearn.preprocessing import LabelEncoder

from storage import get_supabase

router = APIRouter()

BUCKET = "ml-models"


# ── Schemas ───────────────────────────────────────────────────────────────────

class TrainRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_type: str
    dataset: list[dict]
    target_column: str
    hyperparameters: dict = {}
    test_size: float = 0.2

class TrainResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    metrics: dict
    model_key: str  # object path inside the private "ml-models" bucket

class PredictRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_key: str  # object path inside the private "ml-models" bucket
    data: list[dict]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/train", response_model=TrainResponse)
def train(req: TrainRequest):
    df = pd.DataFrame(req.dataset)

    if req.target_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"target_column '{req.target_column}' not found in dataset")

    X = df.drop(columns=[req.target_column])
    y = df[req.target_column]

    le = None
    if y.dtype == object:
        le = LabelEncoder()
        y = le.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=req.test_size, random_state=42)

    model = _build_model(req.model_type, req.hyperparameters)
    model.fit(X_train, y_train)
    metrics = _evaluate(model, X_test, y_test, req.model_type)

    # Serialize model payload to bytes
    payload = {"model": model, "label_encoder": le, "features": list(X.columns)}
    buf = io.BytesIO()
    joblib.dump(payload, buf)
    model_bytes = buf.getvalue()

    # Upload to Supabase Storage
    file_key = f"models/{uuid.uuid4()}.joblib"
    sb = get_supabase()
    sb.storage.from_(BUCKET).upload(
        path=file_key,
        file=model_bytes,
        file_options={"content-type": "application/octet-stream"},
    )
    # Return the object path, not a URL. The bucket is private, and everything that
    # needs these bytes (predict, and later deployment) runs server-side with the
    # service key - so none of them ever needed a URL.
    return TrainResponse(metrics=metrics, model_key=file_key)


@router.post("/predict")
def predict(req: PredictRequest):
    # Read straight from Storage with the service key. The old version fetched its
    # own file back over public HTTP - a needless round trip that also broke the
    # instant the bucket stopped being public.
    try:
        model_bytes = get_supabase().storage.from_(BUCKET).download(req.model_key)
        payload = joblib.load(io.BytesIO(model_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load model: {e}")

    model = payload["model"]
    le    = payload["label_encoder"]

    df = pd.DataFrame(req.data)[payload["features"]]
    preds = model.predict(df)

    if le is not None:
        preds = le.inverse_transform(preds)

    return {"predictions": preds.tolist()}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_model(model_type: str, hp: dict):
    match model_type:
        case "linear_regression":
            return LinearRegression()
        case "logistic_regression":
            return LogisticRegression(max_iter=hp.get("max_iter", 1000))
        case "random_forest_classifier":
            return RandomForestClassifier(
                n_estimators=hp.get("n_estimators", 100),
                max_depth=hp.get("max_depth") or None,
                random_state=42,
            )
        case "random_forest_regressor":
            return RandomForestRegressor(
                n_estimators=hp.get("n_estimators", 100),
                max_depth=hp.get("max_depth") or None,
                random_state=42,
            )
        case _:
            raise HTTPException(status_code=400, detail=f"Unknown model_type: {model_type}")


def _safe_float(val) -> float | None:
    try:
        f = float(val)
        return None if (f != f) else f  # NaN check
    except (TypeError, ValueError):
        return None


def _evaluate(model, X_test, y_test, model_type: str) -> dict:
    preds = model.predict(X_test)
    if "regressor" in model_type or model_type == "linear_regression":
        mse = float(mean_squared_error(y_test, preds))
        return {
            "mse":  mse,
            "rmse": float(np.sqrt(mse)),
            "r2":   _safe_float(r2_score(y_test, preds)),
        }
    else:
        return {"accuracy": float(accuracy_score(y_test, preds))}
