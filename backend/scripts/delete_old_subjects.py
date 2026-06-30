from __future__ import annotations
"""
delete_old_subjects.py
======================
Run once from the backend/ directory:
    python scripts/delete_old_subjects.py

Removes the old placeholder subjects (math, physics, chem, prog, ml, ds, llm, mech)
from Supabase, keeping only the real ones (AI, DAA, DBMS, FSD, TNT, TOC).
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import config  # noqa
from config import supabase

OLD_SUBJECT_IDS = ["math", "physics", "chem", "prog", "ml", "ds", "llm", "mech"]
KEEP_SUBJECT_IDS = {"AI", "DAA", "DBMS", "FSD", "TNT", "TOC"}

def main():
    if supabase is None:
        print("[ERROR] Supabase client not initialised.")
        return 1

    print("=== Deleting old subjects ===")
    for sid in OLD_SUBJECT_IDS:
        try:
            # First clean up any orphaned resources linked to the old subject
            supabase.table("resources").delete().eq("subject_id", sid).execute()
            # Then delete the subject
            supabase.table("subjects").delete().eq("id", sid).execute()
            print(f"  [OK] Deleted subject '{sid}'")
        except Exception as e:
            print(f"  [WARN] Could not delete '{sid}': {e}")

    print()
    print("=== Subjects remaining in DB ===")
    remaining = supabase.table("subjects").select("id, name").execute()
    for s in remaining.data:
        status = "✓" if s["id"] in KEEP_SUBJECT_IDS else "?"
        print(f"  {status} {s['id']} - {s['name']}")

    print()
    print("[DONE] Cleanup complete.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
