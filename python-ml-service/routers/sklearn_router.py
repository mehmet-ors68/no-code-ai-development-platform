import io
import base64
import pickle

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, mean_squared_error, r2_score, classification_report
)
from sklearn.preprocessing import LabelEncoder

router = APIRouter()

# ── Request / Response schemas ──────────────────────────────────────────────

class TrainRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_type: str          # linear_regression | logistic_regression | random_forest_classifier | random_forest_regressor
    dataset: list[dict]      # rows as JSON objects, e.g. [{"feature1": 1.0, "label": 0}, ...]
    target_column: str       # name of the column to predict
    hyperparameters: dict = {}  # model-specific params (n_estimators, max_depth, etc.)
    test_size: float = 0.2

class TrainResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    metrics: dict
    model_b64: str           # pickled model, base64 encoded — caller decides where to store it


class PredictRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_b64: str           # the same base64 string returned from /train
    data: list[dict]         # rows to predict (same feature columns, no target)


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/train", response_model=TrainResponse)
def train(req: TrainRequest):
    df = pd.DataFrame(req.dataset)

    if req.target_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"target_column '{req.target_column}' not found in dataset")

    X = df.drop(columns=[req.target_column])
    y = df[req.target_column]

    # Encode string target labels for classifiers
    le = None
    if y.dtype == object:
        le = LabelEncoder()
        y = le.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=req.test_size, random_state=42
    )

    model = _build_model(req.model_type, req.hyperparameters)
    model.fit(X_train, y_train)
    metrics = _evaluate(model, X_test, y_test, req.model_type)

    # Serialize model + label encoder together so predict works end-to-end
    payload = {"model": model, "label_encoder": le, "features": list(X.columns)}
    model_b64 = base64.b64encode(pickle.dumps(payload)).decode("utf-8")

    return TrainResponse(metrics=metrics, model_b64=model_b64)


@router.post("/predict")
def predict(req: PredictRequest):
    try:
        payload = pickle.loads(base64.b64decode(req.model_b64))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid model_b64")

    model = payload["model"]
    le    = payload["label_encoder"]

    df = pd.DataFrame(req.data)[payload["features"]]
    preds = model.predict(df)

    if le is not None:
        preds = le.inverse_transform(preds)

    return {"predictions": preds.tolist()}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _build_model(model_type: str, hp: dict):
    match model_type:
        case "linear_regression":
            return LinearRegression()
        case "logistic_regression":
            return LogisticRegression(max_iter=hp.get("max_iter", 1000))
        case "random_forest_classifier":
            return RandomForestClassifier(
                n_estimators=hp.get("n_estimators", 100),
                max_depth=hp.get("max_depth", None),
                random_state=42,
            )
        case "random_forest_regressor":
            return RandomForestRegressor(
                n_estimators=hp.get("n_estimators", 100),
                max_depth=hp.get("max_depth", None),
                random_state=42,
            )
        case _:
            raise HTTPException(status_code=400, detail=f"Unknown model_type: {model_type}")


def _evaluate(model, X_test, y_test, model_type: str) -> dict:
    preds = model.predict(X_test)

    if "regressor" in model_type or model_type == "linear_regression":
        return {
            "mse":  float(mean_squared_error(y_test, preds)),
            "rmse": float(np.sqrt(mean_squared_error(y_test, preds))),
            "r2":   float(r2_score(y_test, preds)),
        }
    else:
        return {
            "accuracy": float(accuracy_score(y_test, preds)),
        }
