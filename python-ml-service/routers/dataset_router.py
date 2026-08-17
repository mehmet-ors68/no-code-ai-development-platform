import io
import os
import uuid

import pandas as pd
import requests as req_lib
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import RedirectResponse

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
    # Store the object path, never a URL. get_public_url() would hand back a link that
    # works forever for anyone who sees it, silently bypassing Java's ownership check.
    payload = {
        "name": name,
        "rowCount": len(df),
        "columnCount": len(df.columns),
        "columns": [str(c) for c in df.columns],
        "fileKey": file_key,
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


def _fetch_owned_dataset(dataset_id: str, x_user_id: str) -> dict:
    """Ask Java for the dataset, relying on ITS ownership check.

    Java already returns 403 when the row belongs to someone else and 404 when it
    doesn't exist. Re-implementing that here would mean two copies of the same rule
    drifting apart. We collapse both cases to 404 on the way out so an attacker
    can't tell "exists but isn't yours" from "doesn't exist" — the same reason
    GitHub returns Not Found for private repos.
    """
    resp = req_lib.get(
        f"{JAVA_SERVICE_URL}/api/datasets/{dataset_id}",
        headers={"X-User-ID": x_user_id},
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return resp.json()


@router.get("/datasets/{dataset_id}/download")
async def download_dataset(
    dataset_id: str,
    x_user_id: str = Header(alias="X-User-ID"),
):
    meta = _fetch_owned_dataset(dataset_id, x_user_id)

    # Redirect rather than stream the bytes through this service: the browser fetches
    # straight from Supabase, so a 2GB dataset never crosses the EC2 box. The URL this
    # mints is never stored anywhere and dies in 60 seconds — long enough for the
    # browser to follow the redirect, short enough to be worthless if it leaks.
    sb = get_supabase()
    signed = sb.storage.from_(BUCKET).create_signed_url(meta["fileKey"], expires_in=60)
    return RedirectResponse(signed["signedURL"], status_code=302)


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    x_user_id: str = Header(alias="X-User-ID"),
):
    meta = _fetch_owned_dataset(dataset_id, x_user_id)

    sb = get_supabase()
    # Object first, row second. If the second step fails we're left with a row whose
    # file is gone — visible to the user and fixable. The reverse order leaves a file
    # no row points at: invisible, unreachable, and billed for forever.
    try:
        sb.storage.from_(BUCKET).remove([meta["fileKey"]])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to remove stored file: {e}")

    resp = req_lib.delete(
        f"{JAVA_SERVICE_URL}/api/datasets/{dataset_id}",
        headers={"X-User-ID": x_user_id},
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="File removed but metadata delete failed")

    return {"message": "Dataset deleted"}
