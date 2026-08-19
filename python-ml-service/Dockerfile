FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Fail the BUILD, not production, when the app can't start. FastAPI resolves every
# route signature at import time, so a missing optional dependency (python-multipart)
# raises here. Without this the image builds fine and the container crash-loops on EC2.
# get_supabase() reads env vars lazily, so no secrets are needed to import.
RUN python -c "import main"

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
