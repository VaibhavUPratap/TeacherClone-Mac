from __future__ import annotations
"""
seed_subjects.py
================
Run from backend/ directory:
    python scripts/seed_subjects.py

Upserts the new subjects (AI, DAA, DBMS, FSD, TNT, TOC) and their
teacher clones into Supabase. Safe to re-run.
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import config  # noqa: F401 — loads env vars
from config import supabase
from services.teacher_service import SUBJECTS, TEACHER_CLONES

def main():
    if supabase is None:
        print("[ERROR] Supabase client not initialised. Check your .env file.")
        return 1

    # ── Subjects ──────────────────────────────────────────────────────────────
    print("=== Seeding subjects ===")
    res = supabase.table("subjects").upsert(SUBJECTS).execute()
    print(f"  Upserted {len(SUBJECTS)} subjects")

    # Verify
    all_subjects = supabase.table("subjects").select("id, name").execute()
    print("  Subjects now in DB:")
    for s in all_subjects.data:
        print(f"    {s['id']} - {s['name']}")

    # ── Teachers ──────────────────────────────────────────────────────────────
    print()
    print("=== Seeding teachers ===")
    res = supabase.table("teachers").upsert(TEACHER_CLONES).execute()
    print(f"  Upserted {len(TEACHER_CLONES)} teachers")

    all_teachers = supabase.table("teachers").select("id, name, subject_id").execute()
    print("  Teachers now in DB:")
    for t in all_teachers.data:
        print(f"    {t['id']} -> subject: {t['subject_id']} ({t['name']})")

    print()
    print("[DONE] Seeding complete.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
