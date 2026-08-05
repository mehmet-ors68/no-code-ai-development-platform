import os

from fastapi import HTTPException
from supabase import create_client, Client

# Module-level singleton: the client is created on first use and reused for the
# process lifetime. Creating one per request would open a new connection pool
# every time. Shared by every router that touches Storage (models, datasets).
_supabase: Client | None = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise HTTPException(status_code=500, detail="Supabase storage not configured")
        _supabase = create_client(url, key)
    return _supabase
