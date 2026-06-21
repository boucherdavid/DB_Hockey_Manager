"""Ping le projet Supabase staging pour eviter la pause automatique pour inactivite."""
import os
import sys
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("SUPABASE_URL / SUPABASE_SERVICE_KEY manquants.")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    result = supabase.table("poolers").select("id").limit(1).execute()
    print(f"Keepalive OK — {len(result.data)} ligne(s) lue(s) sur 'poolers'.")

if __name__ == "__main__":
    main()
