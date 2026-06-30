from __future__ import annotations
"""
Run this script once to apply the TeacherClone schema to your Supabase project.
Usage:  python apply_migration.py
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("[ERROR] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Read the migration SQL
migration_path = os.path.join(
    os.path.dirname(__file__), "..", "supabase", "migrations", "20231010000000_initial_schema.sql"
)
with open(os.path.abspath(migration_path), "r", encoding="utf-8") as f:
    sql = f.read()

print("[INFO] Applying migration via Supabase RPC (rpc: exec_sql)...")

# Supabase Python client doesn't expose raw SQL directly, so we'll use
# the PostgREST /rpc/exec endpoint — but first check if the tables exist.
# Instead, print the SQL for manual copy-paste to Supabase SQL editor.
print("\n" + "="*70)
print("ACTION REQUIRED: Copy the SQL below and run it in your Supabase")
print("SQL editor at: https://supabase.com/dashboard/project/yowyjembzbekkkvmhhie/sql")
print("="*70 + "\n")
print(sql)
print("\n" + "="*70)
print("URL: https://supabase.com/dashboard/project/yowyjembzbekkkvmhhie/sql/new")
print("="*70)
