from fastapi import FastAPI
from routers import dataset_router, sklearn_router

app = FastAPI(title="DL Platform ML Service", version="0.1.0")

app.include_router(sklearn_router.router, prefix="/api/ml")
app.include_router(dataset_router.router, prefix="/api/ml")


@app.get("/healthz")
def health():
    return {"status": "ok", "service": "python-ml-service"}
