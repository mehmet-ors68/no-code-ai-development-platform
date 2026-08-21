from fastapi import APIRouter, Header
from pydantic import BaseModel

from prediction import model_schema, run_prediction

router = APIRouter()


class ServePredictRequest(BaseModel):
    data: list[dict]


# The external door: no browser session, no cookie. Both headers are set by Go Gateway
# after RequireAPIKey resolved the caller's key — the key itself is stripped at that
# boundary and never reaches this service. There is no model id in the URL because the
# key already names exactly one model; a path parameter could only ever disagree with it.
@router.post("/predict")
def predict_from_api(
    req: ServePredictRequest,
    x_user_id: str = Header(alias="X-User-ID"),
    x_model_id: str = Header(alias="X-Model-ID"),
):
    return run_prediction(x_model_id, req.data, x_user_id)


@router.get("/schema")
def schema_from_api(
    x_user_id: str = Header(alias="X-User-ID"),
    x_model_id: str = Header(alias="X-Model-ID"),
):
    return model_schema(x_model_id, x_user_id)
