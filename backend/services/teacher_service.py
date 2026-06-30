from __future__ import annotations
from config import supabase

SUBJECTS = [
    {"id": "AI",   "name": "Artificial Intelligence",          "icon": "Brain",     "description": "Search, Knowledge, Reasoning, and AI Agents",                  "enrolled_count": 0},
    {"id": "DAA",  "name": "Design & Analysis of Algorithms",  "icon": "Binary",    "description": "Complexity, Sorting, Graphs, Greedy, DP, and Backtracking",     "enrolled_count": 0},
    {"id": "DBMS", "name": "Database Management Systems",      "icon": "Database",  "description": "SQL, Normalization, Transactions, and Query Optimization",       "enrolled_count": 0},
    {"id": "FSD",  "name": "Full Stack Development",           "icon": "Code",      "description": "HTML, CSS, JavaScript, React, Node.js, and REST APIs",          "enrolled_count": 0},
    {"id": "TNT",  "name": "Transform & Numerical Techniques", "icon": "Sigma",     "description": "Fourier, Laplace, Z-Transforms, and Numerical Methods",          "enrolled_count": 0},
    {"id": "TOC",  "name": "Theory of Computation",            "icon": "Cpu",       "description": "Automata, Regular Languages, CFGs, Turing Machines",            "enrolled_count": 0},
]

# Resources will be loaded from Supabase (ingested via ingest_local_documents.py)
RESOURCES: dict = {}

TEACHER_CLONES = [
    # ── AI Teacher ────────────────────────────────────────────────────────────
    {
        "id": "andrew-ml",
        "name": "Andrew",
        "subject_id": "AI",
        "teaching_style": "Intuition-First, Mathematically Rigorous",
        "description": "Builds deep intuition before diving into math. Known for clear visual explanations of complex AI/ML concepts.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=andrew-ml",
        "personality_prompt": (
            "You are Andrew, an Artificial Intelligence instructor renowned for making complex ideas click. "
            "You always start with the intuition — why does this matter and how does it feel conceptually — "
            "before introducing any equations. You use concrete, relatable examples to anchor abstract ideas. "
            "Your tone is calm, encouraging, and genuinely excited about the subject. You break down math "
            "step-by-step, checking understanding at each stage. You frequently say things like "
            "'Let me show you why this works' and 'The key insight here is…'. "
            "You treat every student as capable of mastering AI with the right explanation."
        ),
        "voice_id": "andrew-ml"
    },
    # ── DAA Teacher ───────────────────────────────────────────────────────────
    {
        "id": "erik-adsa",
        "name": "Erik",
        "subject_id": "DAA",
        "teaching_style": "Problem-Pattern Recognition",
        "description": "Teaches algorithms through patterns and problem-solving frameworks. Systematic and complexity-focused.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=erik-adsa",
        "personality_prompt": (
            "You are Erik, a Design & Analysis of Algorithms instructor who thinks in patterns. "
            "For every problem, you first identify which algorithmic pattern applies (divide and conquer, "
            "greedy, dynamic programming, backtracking, etc.) before writing a single line of code. "
            "You are highly systematic: you always walk through examples by hand first, then derive the algorithm, "
            "then analyze time and space complexity. You ask probing questions like 'What's the brute-force first?' "
            "and 'Where is the bottleneck?'. You are energetic and enjoy the elegance of efficient algorithms."
        ),
        "voice_id": "erik-adsa"
    },
    # ── FSD Teacher ───────────────────────────────────────────────────────────
    {
        "id": "david-c",
        "name": "David",
        "subject_id": "FSD",
        "teaching_style": "Build-First, Explain-Why",
        "description": "Teaches Full Stack by building real projects — understands the entire request lifecycle.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=david-c",
        "personality_prompt": (
            "You are David, an expert Full Stack Development instructor. "
            "You teach by building real things: REST APIs, React UIs, database schemas, and deployments. "
            "You are direct, practical, and always explain why a technology choice was made. "
            "You say things like 'Let's trace this request end-to-end' and 'What does the browser actually receive?'. "
            "You believe understanding the full stack makes you a 10x better developer at any single layer."
        ),
        "voice_id": "david-c"
    },
    # ── TOC Teacher ───────────────────────────────────────────────────────────
    {
        "id": "grant-llm",
        "name": "Grant",
        "subject_id": "TOC",
        "teaching_style": "Formal yet Intuitive",
        "description": "Makes Theory of Computation accessible — from DFAs to Turing machines with clear visual thinking.",
        "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=grant-llm",
        "personality_prompt": (
            "You are Grant, a Theory of Computation instructor who bridges rigorous formal proofs and intuition. "
            "You explain automata, grammars, and Turing machines using concrete examples and state diagrams. "
            "You are passionate about making formal language theory feel natural and approachable. "
            "You often say 'Think of this machine as a simple rule-follower' and "
            "'The key insight in this proof is…'. Your tone is calm, intellectually honest, and encouraging."
        ),
        "voice_id": "grant-llm"
    },
]

class TeacherService:
    @staticmethod
    def get_subjects():
        if supabase is not None:
            try:
                response = supabase.table("subjects").select("*").execute()
                if response.data:
                    return response.data
            except Exception as e:
                print(f"Supabase Subjects Error: {e}")
        return SUBJECTS

    @staticmethod
    def get_resources_by_subject(subject_id: str):
        if supabase is not None:
            try:
                response = supabase.table("resources").select("*").eq("subject_id", subject_id).execute()
                if response.data:
                    return response.data
            except Exception as e:
                print(f"Supabase Resources Error: {e}")
        return RESOURCES.get(subject_id, [])

    @staticmethod
    def get_resource_by_id(resource_id: str):
        if supabase is not None:
            try:
                response = supabase.table("resources").select("*").eq("id", resource_id).single().execute()
                if response.data:
                    return response.data
            except Exception:
                pass
        
        for subject_resources in RESOURCES.values():
            for res in subject_resources:
                if res["id"] == resource_id:
                    return res
        return None

    @staticmethod
    def get_teachers_by_subject(subject_id: str):
        if supabase is not None:
            try:
                response = supabase.table("teachers").select("*").eq("subject_id", subject_id).execute()
                return response.data if response.data is not None else []
            except Exception as e:
                print(f"Supabase Teachers Error: {e}")
        return [t for t in TEACHER_CLONES if t["subject_id"] == subject_id]

    @staticmethod
    def get_teacher_by_id(teacher_id: str):
        if supabase is not None:
            try:
                response = supabase.table("teachers").select("*").eq("id", teacher_id).execute()
                if response.data:
                    return response.data[0]
            except Exception:
                pass
        return next((t for t in TEACHER_CLONES if t["id"] == teacher_id), None)

    @staticmethod
    def seed_db():
        """
        Upsert all subjects, teachers, resources, and voices into Supabase.
        Safe to call multiple times — uses upsert (ON CONFLICT DO UPDATE).
        """
        if supabase is None:
            return

        try:
            # Upsert subjects (includes new LLM subject)
            supabase.table("subjects").upsert(SUBJECTS).execute()
            print("[OK] Upserted subjects.")

            # Upsert teachers (includes new Andrew, David, Erik, Grant)
            supabase.table("teachers").upsert(TEACHER_CLONES).execute()
            print("[OK] Upserted teachers.")

            # Upsert resources
            all_resources = []
            for sub_id, res_list in RESOURCES.items():
                for r in res_list:
                    r_copy = dict(r)         # avoid mutating the constant
                    r_copy["subject_id"] = sub_id
                    all_resources.append(r_copy)
            if all_resources:
                supabase.table("resources").upsert(all_resources).execute()
                print("[OK] Upserted resources.")

            # Upsert voices (existing + new teacher voices)
            try:
                all_voices = [
                    {"id": "dr-rao",      "filename": "dr-rao.wav"},
                    {"id": "ms-priya",    "filename": "ms-priya.aac"},
                    {"id": "prof-sharma", "filename": "prof-sharma.wav"},
                    # New cloned voices (files generated by extract_teacher_voices.py)
                    {"id": "andrew-ml",   "filename": "andrew-ml.wav"},
                    {"id": "david-c",     "filename": "david-c.wav"},
                    {"id": "erik-adsa",   "filename": "erik-adsa.wav"},
                    {"id": "grant-llm",   "filename": "grant-llm.wav"},
                ]
                supabase.table("voices").upsert(all_voices).execute()
                print("[OK] Upserted voices (including cloned teacher voices).")
            except Exception as voice_err:
                print(f"[WARNING] Seeding voices table failed: {voice_err}")

        except Exception as e:
            print(f"[WARNING] Seeding failed: {e}. Ensure tables exist in Supabase.")

teacher_service = TeacherService()

