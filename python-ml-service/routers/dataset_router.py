import io
import os
import uuid

import pandas as pd
import requests as req_lib
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from storage import get_supabase

router = APIRouter()

BUCKET = "datasets"

# Internal Docker-network address. Python calls Java directly instead of handing
# the metadata back to the browser and making it do a second round trip through
# Nginx + Go Gateway. Same network, no TLS, no public internet.
JAVA_SERVICE_URL = os.environ.get("JAVA_SERVICE_URL", "http://java-service:8081")


@router.post("/datasets", status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    # Go Gateway validates the JWT and injects this header on every /api/ml/* call.
    # We never re-validate it — we only forward it so Java knows whose dataset this is.
    x_user_id: str = Header(alias="X-User-ID"),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Parse only to derive metadata. The bytes we store are the original ones,
    # untouched — pandas' round-trip would silently reformat dates, floats, quoting.
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    if df.empty or len(df.columns) == 0:
        raise HTTPException(status_code=400, detail="CSV has no rows or no columns")

    file_key = f"raw/{uuid.uuid4()}.csv"
    sb = get_supabase()
    sb.storage.from_(BUCKET).upload(
        path=file_key,
        file=raw,
        file_options={"content-type": "text/csv"},
    )
    file_url = sb.storage.from_(BUCKET).get_public_url(file_key)

    payload = {
        "name": name,
        "rowCount": len(df),
        "columnCount": len(df.columns),
        "columns": [str(c) for c in df.columns],
        "fileUrl": file_url,
    }

    try:
        resp = req_lib.post(
            f"{JAVA_SERVICE_URL}/api/datasets",
            json=payload,
            headers={"X-User-ID": x_user_id},
            timeout=10,
        )
        resp.raise_for_status()
    except Exception as e:
        # A stored file with no DB row is unreachable garbage — nothing will ever
        # list it or delete it. Roll the upload back.
        # Note this is the opposite call from training: there, a failed save still
        # leaves the user with metrics worth showing, so it must not abort. Here
        # there is no partial result — a dataset the user can't see isn't a dataset.
        try:
            sb.storage.from_(BUCKET).remove([file_key])
        except Exception:
            pass  # best effort; the original error is what matters
        raise HTTPException(status_code=502, detail=f"Failed to save dataset metadata: {e}")

    # Java owns the Dataset shape (id, createdAt, …) — pass its response straight
    # through rather than redefining the same fields a third time here.
    return resp.json()
