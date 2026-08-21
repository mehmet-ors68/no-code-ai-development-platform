from fastapi import FastAPI
from routers import dataset_router, serve_router, sklearn_router

app = FastAPI(title="DL Platform ML Service", version="0.1.0")

app.include_router(sklearn_router.router, prefix="/api/ml")
app.include_router(dataset_router.router, prefix="/api/ml")
# Separate prefix, separate trust boundary: everything under /api/ml reaches this
# service behind a browser cookie, everything under /api/serve behind an API key.
# The gateway is what tells them apart; both arrive here with X-User-ID already proved.
app.include_router(serve_router.router, prefix="/api/serve")


@app.get("/healthz")
def health():
    return {"status": "ok", "service": "python-ml-service"}
