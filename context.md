# TeacherClone — Project Context

**Last Updated**: June 7, 2026

---

## 📋 Project Overview

TeacherClone is an AI-powered educational tutoring platform. Students select a subject, choose an AI teacher clone, and learn through real-time streaming conversations grounded in uploaded lecture materials (RAG). Teachers and admins manage content through a separate dashboard view. The app features Google OAuth + email/password auth via Supabase, local text-to-speech using Coqui XTTS-v2 with **real voice cloning from lecture videos**, analytics dashboards, and role-based access control.

**Repository**: VaibhavUPratap/TeacherClone

---

## 🏗️ Architecture Overview

### Technology Stack

#### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Vector Database**: ChromaDB (local RAG document retrieval)
- **Database**: Supabase (PostgreSQL) — primary persistent store for all relational data
- **AI Models**:
  - Ollama `llama3` — local chat inference (primary)
  - Ollama `nomic-embed-text` — local embeddings for RAG
  - Google Gemini 2.5 Flash — cloud fallback when Ollama is unavailable
- **Text-to-Speech**: Native macOS speech synthesis (`say` CLI utility with Siri/system voices) for runtime speech; fallback to Coqui XTTS-v2 on non-Mac platforms.
- **Voice Cloning Pipeline**: FFmpeg + WebRTC VAD (webrtcvad-wheels) + Coqui XTTS-v2 (used strictly for generating voice reference files)
  - Extracts 25s of clean sustained speech from lecture MP4s as speaker references
  - Per-teacher audio tuning: skip_intro_s, loudnorm normalization, VAD aggressiveness
  - All voices normalized to EBU R128 standard (-16 dB LUFS)
- **Transcription**: OpenAI Whisper (local, `openai-whisper`) — Phase 2 complete (run on GPU, Whisper base model)
- **Authentication**: Supabase Auth (JWT) verified by the backend
- **Password Hashing**: bcrypt via passlib
- **File Handling**: PyMuPDF (PDF text extraction), python-pptx (PPTX slide extraction)

#### Hardware (Local Machine)
- **GPU**: Apple Silicon Integrated GPU (Metal/MPS)
- **Unified Memory**: M-series Shared Memory
- **PyTorch**: Native `torch` with MPS (Metal Performance Shaders) backend support
- **Voice Cloning & Whisper on GPU**: Local voice analysis and transcription utilize MPS (Metal Performance Shaders) for GPU acceleration (or CPU fallback via `PYTORCH_ENABLE_MPS_FALLBACK=1`), while runtime speech synthesis is offloaded to macOS native speech engines.

#### Frontend
- **Framework**: React 18 (JSX)
- **Build Tool**: Vite 5
- **State Management**: React Hooks + Context API
- **Routing**: React Router v7
- **Auth Client**: Supabase JS (`@supabase/supabase-js`)
- **HTTP**: Axios / Fetch for backend API calls
- **UI Libraries**:
  - Framer Motion — animations & transitions
  - Lucide React — icons
  - Recharts — analytics charts
- **Styling**: Vanilla CSS with glassmorphism/atmospheric design system (CSS custom properties, OKLCH colours)

#### Infrastructure
- **Auth Provider**: Supabase (email/password + Google OAuth)
- **Google OAuth**: Configured via Google Cloud Console + Supabase Auth Providers
- **Ollama**: Running locally on `http://localhost:11434`
- **API Base**: `http://localhost:8000` (development)
- **Frontend Dev Server**: `http://localhost:5173` (Vite)
- **FFmpeg**: Gyan build installed via winget — PATH injected dynamically by `config.py`

---

## 📁 Directory Structure

```
TeacherClone/
├── backend/                        # FastAPI server
│   ├── main.py                     # App entry point, middleware, router mounting
│   ├── config.py                   # Settings (pydantic-settings), Supabase client init, FFmpeg PATH injection
│   ├── requirements.txt            # Mac-adapted dependencies
│   ├── .env
│   ├── routers/
│   │   ├── auth.py                 # POST /auth/login, /auth/logout, /auth/refresh
│   │   ├── chat.py                 # POST /chat/message, GET /chat/stream, GET /chat/history
│   │   ├── ingest.py               # POST /ingest/file, GET /ingest/documents, DELETE /ingest/document/{id}
│   │   ├── tts.py                  # POST /tts/speak, GET /tts/voices, POST /tts/upload, GET /tts/voices/{id}
│   │   ├── clone.py                # POST /clone/create, GET /clone/status/{id}, DELETE /clone/{id} (Clone Studio)
│   │   └── dashboard.py            # GET /dashboard/analytics/{user_id}
│   ├── services/
│   │   ├── auth_service.py         # JWT creation/verification, Supabase user lookup
│   │   ├── chat_service.py         # RAG pipeline: embed + ChromaDB + Ollama/Gemini stream
│   │   ├── teacher_service.py      # Teacher clone CRUD, personality prompt management, DB seeding (upsert-safe)
│   │   ├── ingest_service.py       # PDF/PPTX text extraction, chunking, ChromaDB ingestion/deletion
│   │   ├── vector_service.py       # ChromaDB wrapper (add, query, delete collections/documents)
│   │   ├── tts_service.py          # macOS native 'say' speech synthesis, with fallback to Coqui XTTS-v2 on non-Mac platforms
│   │   ├── voice_extraction_service.py  # FFmpeg+VAD pipeline: MP4 -> normalized 25s WAV
│   │   ├── clone_service.py        # Orchestrates dynamic voice & personality cloning pipeline from uploaded video
│   │   ├── dashboard_service.py    # Aggregates Supabase chat metrics for analytics
│   │   └── knowledge_base.py       # Static keyword-based fast-path answer lookup
│   ├── schemas/                    # Pydantic request/response models
│   ├── scripts/                    # CLI utilities (run from backend/ directory)
│   │   ├── extract_teacher_voices.py   # Batch voice extraction - COMPLETED, all 4 voices extracted
│   │   ├── test_clone.py               # End-to-end clone test - COMPLETED, all 4 passed on GPU
│   │   ├── transcribe_lectures.py      # Whisper transcription + Ollama personality extraction (Phase 2)
│   │   ├── ingest_lecture_transcripts.py  # Chunk transcripts -> ChromaDB RAG ingestion (Phase 2)
│   │   ├── seed_subjects.py            # Upserts university subjects and default teachers to DB
│   │   ├── delete_old_subjects.py      # Cleans up placeholder subjects from DB
│   │   ├── ingest_local_documents.py   # Scans data/documents/ recursively to ingest documents
│   │   └── check_voice_quality.py      # ffprobe quality report on extracted voices
│   └── data/
│       ├── videos/                 # Source lecture MP4s
│       │   ├── Andrew-ML.mp4       # 135.9 MB - Machine Learning
│       │   ├── David-C.mp4         # 218.5 MB - C Programming
│       │   ├── Erik-ADSA.mp4       # 259.0 MB - Algorithms & Data Structures
│       │   └── Grant-LLM.mp4       # 60.7 MB  - Large Language Models
│       ├── voices/                 # XTTS-v2 speaker reference WAVs (16kHz mono, ~782 KB each)
│       │   ├── andrew-ml.wav       # skip=8s, loudnorm, VAD=1 - mean=-16.8 dB
│       │   ├── david-c.wav         # skip=78s (past title gap), loudnorm, VAD=2 - mean=-16.4 dB
│       │   ├── erik-adsa.wav       # skip=22s, loudnorm+limiter (was clipping 0dB), VAD=3 - mean=-16.8 dB
│       │   ├── grant-llm.wav       # skip=2s, no loudnorm needed - mean=-15.3 dB
│       │   ├── dr-rao.wav          # Original Math teacher voice
│       │   ├── prof-sharma.wav     # Original Math teacher voice
│       │   ├── ms-priya.aac        # Original Math teacher voice
│       │   └── vaibhav.aac         # Developer test voice
│       ├── audio/                  # Generated TTS output WAVs
│       │   ├── clone_test_andrew-ml.wav   # Test clone output - 22.7s inference, 637 KB
│       │   ├── clone_test_david-c.wav     # Test clone output - 14.2s inference, 631 KB
│       │   ├── clone_test_erik-adsa.wav   # Test clone output - 10.8s inference, 491 KB
│       │   └── clone_test_grant-llm.wav   # Test clone output - 12.4s inference, 553 KB
│       ├── documents/              # Subject-specific local documents (e.g. AI/, DAA/)
│       ├── transcripts/            # Whisper transcripts & personality profiles (Phase 2)
│       └── chroma_db/              # ChromaDB vector store
├── static/audio/               # Generated TTS audio files served via /static
├── frontend/                       # React SPA
│   ├── .env                        # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx                # ReactDOM.createRoot, wraps App in AuthProvider
│       ├── App.jsx                 # Router, route definitions (includes /dashboard/clone-studio)
│       ├── supabase.js             # Unified Supabase client (real + mock fallback)
│       ├── index.css               # Full design system (atmospheric/glassmorphism)
│       ├── tokens.css              # CSS custom properties (colours, spacing, typography)
│       ├── widgets.css             # Reusable widget styles
│       ├── context/
│       │   └── AuthContext.jsx     # Global auth state (user, role, loading) via onAuthStateChange
│       ├── api/
│       │   └── api.js              # Axios/fetch wrapper for FastAPI backend
│       ├── pages/
│       │   ├── Login.jsx           # Role picker (Step 1) + email/password + Google OAuth (Step 2)
│       │   ├── Home.jsx            # Root redirect page
│       │   ├── OAuthCallback.jsx   # /auth/callback — handles Google OAuth redirect, upserts profile
│       │   └── dashboard/
│       │       ├── StudentHome.jsx         # Student landing: subject cards, recent activity
│       │       ├── SubjectSelection.jsx    # Subject → Teacher selection → AI chat interface (full flow)
│       │       ├── TeacherInteraction.jsx  # Embedded teacher chat (used within subject flow)
│       │       ├── StudentAnalytics.jsx    # Personal learning stats with Recharts
│       │       ├── Conversations.jsx       # Chat history viewer
│       │       ├── ClassData.jsx           # Teacher/Admin: class overview, student data
│       │       ├── Lectures.jsx            # Lecture upload, library ingestion, and deletion management
│       │       ├── Slides.jsx              # Slide deck viewer
│       │       ├── Archive.jsx             # Archived content
│       │       ├── Voices.jsx              # Admin: custom TTS voice management
│       │       └── CloneStudio.jsx         # Admin/Teacher: Automated custom clone studio pipeline
│       └── components/
│           ├── Dashboard.jsx               # Stub/wrapper
│           ├── StudentChat.jsx             # Stub/wrapper
│           ├── chat/
│           │   ├── StudentChat.jsx         # Full chat UI with streaming, TTS button
│           │   └── MessageRenderer.jsx     # Renders text, code, citations, audio player
│           └── layout/
│               └── DashboardLayout.jsx     # Sidebar, header, theming wrapper for all dashboard routes
├── supabase/
│   └── migrations/
│       ├── 20231010000000_initial_schema.sql       # subjects, teachers, resources, chats, documents tables
│       ├── 20260531000000_proper_database.sql      # profiles table, voices table, handle_new_user trigger
│       └── 20260531010000_google_oauth_role_upsert.sql  # INSERT policy + ON CONFLICT DO UPDATE for OAuth
├── .env.example
├── context.md                      # This file
└── README.md
```

---

## 👨‍🏫 Teacher Clones

### University Subjects Structure
The platform features structured course subjects and corresponding default teacher profiles seeded in the database. Custom teachers can also be created dynamically using Clone Studio.

### Default Seeded Teacher Clones
| ID | Name | Subject ID | Voice ID | Style | Description |
|---|---|---|---|---|---|
| `andrew-ml` | Andrew | `AI` | `andrew-ml` | Intuition-First, Mathematically Rigorous | Artificial Intelligence instructor, intuition-first |
| `erik-adsa` | Erik | `DAA` | `erik-adsa` | Problem-Pattern Recognition | Design & Analysis of Algorithms instructor, pattern-focused |
| `dr-rao` | Dr. Rao | `DBMS` | `dr-rao` | Conceptual & Analytical | Database Management Systems senior professor |
| `david-c` | David | `FSD` | `david-c` | Build-First, Explain-Why | Full Stack Development builder-focused instructor |
| `prof-sharma` | Prof. Sharma | `TNT` | `prof-sharma` | Numerical-Driven | Transform & Numerical Techniques worked-examples expert |
| `grant-llm` | Grant | `TOC` | `grant-llm` | Formal yet Intuitive | Theory of Computation automata & Turing machines expert |

### Subjects
| ID | Name | Description |
|---|---|---|
| `AI` | Artificial Intelligence | Search, Knowledge, Reasoning, and AI Agents |
| `DAA` | Design & Analysis of Algorithms | Complexity, Sorting, Graphs, Greedy, DP, and Backtracking |
| `DBMS` | Database Management Systems | SQL, Normalization, Transactions, and Query Optimization |
| `FSD` | Full Stack Development | HTML, CSS, JavaScript, React, Node.js, and REST APIs |
| `TNT` | Transform & Numerical Techniques | Fourier, Laplace, Z-Transforms, and Numerical Methods |
| `TOC` | Theory of Computation | Automata, Regular Languages, CFGs, Turing Machines |

---

## 🎤 Voice Cloning Pipeline (Phase 1 — COMPLETE)

### Architecture
```
Lecture Video (.mp4)
  │
  ▼ FFmpeg (Gyan build, via config.py PATH)
  │  - Seek to skip_intro_s (per-teacher, from audio analysis)
  │  - Extract 95s buffer as 16kHz mono PCM
  │  - Apply loudnorm (EBU R128: I=-16, TP=-1.5, LRA=11) + hard limiter
  │
  ▼ WebRTC VAD (webrtcvad-wheels)
  │  - Frame size: 30ms
  │  - Sustained-speech filter: requires >=10 consecutive voiced frames (300ms)
  │    (rejects music/noise bursts that trigger VAD in isolated frames)
  │  - Collect first 25s of qualifying voiced speech
  │
  ▼ Final loudnorm pass on output WAV
  │
  ▼ data/voices/{voice_id}.wav
       16kHz mono, ~782 KB, ~25s, EBU R128 normalized
```

### Clone Studio (Automated User-Driven Cloning)
Admins can upload lecture videos in **Clone Studio** to trigger this entire pipeline dynamically.

### Per-Teacher Audio Analysis Results
| Teacher | Issue Found | Fix Applied |
|---|---|---|
| Andrew (ML) | Audio at -38 dB mean (nearly silent) | skip=8s + loudnorm → -16.8 dB |
| David (C) | 0-75s: title-card silence gap, then loud intro | skip=78s → jumps to first real speech |
| Erik (ADSA) | Clipping at 0 dB (distorted/overdriven) | skip=22s + loudnorm + limiter → -16.8 dB |
| Grant (LLM) | Already clean, continuous speech from 0s | skip=2s, no loudnorm needed |

### XTTS-v2 Clone Test Results (GPU — Apple Silicon MPS)
| Voice ID | Inference Time | File Size | Real-Time Factor |
|---|---|---|---|
| `andrew-ml` | 22.7s | 637 KB | 1.51x |
| `david-c` | 14.2s | 631 KB | 0.96x |
| `erik-adsa` | 10.8s | 491 KB | 0.94x |
| `grant-llm` | 12.4s | 553 KB | 0.96x |

RTF < 1.0 = generating audio faster than it plays back. Accelerated on Apple Silicon.

---

## 🖥️ TTS Service — macOS Native Speech Synthesis (Apple Intelligence / Siri Voices)

`tts_service.py` is configured to:
- **Detect macOS platform**: Automatically flags `IS_MACOS = True` on Darwin systems.
- **Skip XTTS-v2 Startup**: Bypasses downloading and loading the heavy Coqui XTTS-v2 model at startup, saving ~3-4 GB of unified memory/VRAM and making backend startup instant.
- **Dynamic Voice Mapping**: Resolves teacher clone IDs to high-quality system/Siri voices (e.g. `Reed`, `Rocko`, `Grandpa`, `Rishi`, `Samantha`).
- **Asynchronous Execution**: Synthesizes speech using the local `say` utility inside an offloaded thread pool executor.
- **Pacing Speed Filter**: If custom pacing is configured, routes the output audio through FFmpeg `atempo` to adjust playback speed before returning.
- **Non-macOS Compatibility**: Falls back to Coqui XTTS-v2 on other platforms (Windows/Linux/CUDA).

---

## 🔄 Detailed Workflows

### 1. Authentication Flow

**Email/Password:**
```
/login → role pick → enter credentials
→ supabase.auth.signInWithPassword({ email, password })
→ real Supabase (if credentials valid) OR mock fallback (@teacherclone.edu demo accounts)
→ SIGNED_IN event → AuthContext updates user + fetches role from profiles
→ setGlobalRole(verifiedRole) → navigate('/dashboard')
```

**Google OAuth:**
```
/login → role pick → "Continue with Google"
→ localStorage.setItem('pendingOAuthRole', role)  ← saved BEFORE redirect
→ supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback', queryParams: { role } })
→ Browser → Google sign-in → Supabase token exchange
→ Redirect to /auth/callback
→ OAuthCallback: getSession() → read pendingOAuthRole → upsert profiles table → navigate('/dashboard')
```

**Token Refresh**: Supabase JS SDK handles silently via `onAuthStateChange`.
**Logout**: `supabase.auth.signOut()` → clears localStorage (`userRole`, `mockUser`) → SIGNED_OUT event → user = null → redirect to `/login`.

### 2. Student Chat (AI Teacher) Flow
```
StudentHome → pick subject → SubjectSelection.jsx
→ Subject cards fetched from Supabase (subjects table)
→ Pick teacher clone (teachers table, filtered by subject_id)
→ TeacherInteraction.jsx / StudentChat.jsx
→ User types question → POST /chat/stream?teacher_id=X
→ Backend: chat_service.stream_answer()
    1. Fetch teacher personality_prompt from teacher_service
    2. Embed question with nomic-embed-text (Ollama)
    3. Query ChromaDB for top-3 relevant chunks (filtered by subject_id)
    4. Build RAG prompt: context + question + teacher persona
    5. POST to Ollama llama3 (stream: true) → yields SSE tokens
    6. Log question to Supabase chats table
→ Frontend: ReadableStream reads SSE → appends tokens to message buffer
→ Framer Motion renders token-by-token typing animation
→ Optional TTS button → triggers TTS flow
```

**Fallback**: If Ollama is unavailable → `_generate_with_gemini()` uses Gemini 2.5 Flash (non-streaming).

### 3. Document Ingestion Flow
```
Lectures.jsx / Resources section
→ User selects PDF/PPTX/TXT/MD → POST /ingest/file (multipart)
→ ingest_service.py:
    1. Saves document in subject-specific folder under data/documents/{subject_id}/
    2. Extract text (PDF: PyMuPDF, PPTX: python-pptx, TXT/MD: raw)
    3. Sanitize text by stripping null bytes and invalid control chars
    4. Split into chunks (~500 tokens)
    5. Embed chunks (nomic-embed-text) and store in ChromaDB (attaching file_id & subject_id to metadata)
    6. Sync to Supabase public.documents and public.resources (truncating content to 12k chars to prevent row limits)
→ Frontend updates library inventory.
```

### 4. Document Deletion Flow
```
Lectures.jsx → Click Delete → Confirm modal → DELETE /ingest/document/{file_id}
→ backend: ingest_service.delete_document()
    1. Fetch filename and subject_id from Supabase documents table
    2. Delete database records from Supabase public.documents & public.resources
    3. Purge vector chunks from ChromaDB by file_id / filename
    4. Remove physical file from data/documents/{subject_id}/
```

### 5. Clone Studio Pipeline Flow
```
CloneStudio.jsx → upload video file + details → POST /clone/create
→ backend: clone_service.start_clone_job()
    1. Save video to data/videos/
    2. Extract reference WAV (FFmpeg + WebRTC VAD) -> data/voices/ (fallback if extraction fails)
    3. Transcribe video with OpenAI Whisper on GPU -> data/transcripts/
    4. Extract teaching personality prompt from transcript (Ollama)
    5. Sync/upsert clone record and voice into Supabase public.teachers & public.voices
→ Frontend: Poll GET /clone/status/{job_id} for progress (Save -> Voice -> Whisper -> Ollama -> DB)
→ Finalization: Preview voice, edit prompt → PATCH /clone/{teacher_id}/finalize to save personality prompt.
```

### 1. Authentication Flow

**Email/Password:**
```
/login → role pick → enter credentials
→ supabase.auth.signInWithPassword({ email, password })
→ real Supabase (if credentials valid) OR mock fallback (@teacherclone.edu demo accounts)
→ SIGNED_IN event → AuthContext updates user + fetches role from profiles
→ setGlobalRole(verifiedRole) → navigate('/dashboard')
```

**Google OAuth:**
```
/login → role pick → "Continue with Google"
→ localStorage.setItem('pendingOAuthRole', role)  ← saved BEFORE redirect
→ supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback', queryParams: { role } })
→ Browser → Google sign-in → Supabase token exchange
→ Redirect to /auth/callback
→ OAuthCallback: getSession() → read pendingOAuthRole → upsert profiles table → navigate('/dashboard')
```

**Token Refresh**: Supabase JS SDK handles silently via `onAuthStateChange`.
**Logout**: `supabase.auth.signOut()` → clears localStorage (`userRole`, `mockUser`) → SIGNED_OUT event → user = null → redirect to `/login`.

### 2. Student Chat (AI Teacher) Flow
```
StudentHome → pick subject → SubjectSelection.jsx
→ Subject cards fetched from Supabase (subjects table)
→ Pick teacher clone (teachers table, filtered by subject_id)
→ TeacherInteraction.jsx / StudentChat.jsx
→ User types question → POST /chat/stream?teacher_id=X
→ Backend: chat_service.stream_answer()
    1. Fetch teacher personality_prompt from teacher_service
    2. Embed question with nomic-embed-text (Ollama)
    3. Query ChromaDB for top-3 relevant chunks (filtered by subject_id)
    4. Build RAG prompt: context + question + teacher persona
    5. POST to Ollama llama3 (stream: true) → yields SSE tokens
    6. Log question to Supabase chats table
→ Frontend: ReadableStream reads SSE → appends tokens to message buffer
→ Framer Motion renders token-by-token typing animation
→ Optional TTS button → triggers TTS flow
```

**Fallback**: If Ollama is unavailable → `_generate_with_gemini()` uses Gemini 2.5 Flash (non-streaming).

### 3. Document Ingestion Flow
```
Lectures.jsx / Resources section
→ User selects PDF or PPTX → POST /ingest/file (multipart)
→ ingest_service.py:
    PDF: PyMuPDF extracts text page by page
    PPTX: python-pptx extracts slide text frames
→ Text split into semantic chunks (~500 tokens each)
→ Each chunk embedded with nomic-embed-text → stored in ChromaDB
→ Document metadata (filename, chunk_count, subject_id) saved to Supabase documents table
→ Frontend shows progress / success state
```

### 4. Text-to-Speech Flow (macOS Native)
```
Student clicks "Read aloud" on a chat message
→ POST /tts/speak { text, voice_id: "andrew-ml", language: "en" }
→ tts_service.py:
    1. Resolve Voice: Maps teacher ID (e.g. `andrew-ml`) to high-quality macOS system voice (e.g. `Reed`).
    2. Synthesize: Invokes the native `say` command asynchronously in a thread pool to generate a 16kHz mono WAV file:
       `say -o <path> --file-format=WAVE --data-format=LEI16@16000 -v <voice_name> <text>`
    3. Pacing: Adjusts pacing using FFmpeg `atempo` if custom pacing is configured.
→ FileResponse streams WAV to frontend
→ Frontend: HTMLAudioElement plays the generated speech voice
```

### 5. Analytics Flow
```
StudentAnalytics.jsx mounts
→ GET /dashboard/analytics/{user_id}
→ dashboard_service.py queries Supabase chats table:
    - Message count over time
    - Topic/category distribution
    - Most active sessions
→ Returns JSON → Recharts renders line/bar/pie charts
→ User can filter by date range
```

### 6. Voice Management Flow (Admin)
```
Voices.jsx (admin only)
→ Admin uploads audio sample (WAV/MP3)
→ POST /tts/upload { voice_id, file }
→ tts_service.py saves audio to data/voices/
→ Metadata upserted into Supabase voices table
→ voice_id linked to a teacher record in teachers table
→ When that teacher's clone speaks, XTTS uses the cloned voice
```

### 7. Error Handling & Fallbacks

| Layer | Strategy |
|---|---|
| Supabase client | Real → mock proxy; any query error falls back to mock data silently |
| Chat AI | Ollama primary → Gemini 2.5 Flash fallback |
| TTS | XTTS-v2 with custom voice → first available voice fallback |
| Auth | Real Supabase → mock session (localStorage) for demo accounts |
| API responses | Standard `{ success, data?, error? }` shape; 401/403 trigger logout |

---

## 🗄️ Database Schema (Supabase / PostgreSQL)

All tables have Row Level Security (RLS) enabled.

### `public.profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | References `auth.users(id)` ON DELETE CASCADE |
| `email` | TEXT | User email |
| `full_name` | TEXT | Display name |
| `role` | TEXT | `'student'` \| `'teacher'` \| `'admin'` (default: `'student'`) |
| `created_at` | TIMESTAMPTZ | |

**Trigger**: `handle_new_user` fires `AFTER INSERT ON auth.users` — inserts a profile row with `ON CONFLICT (id) DO UPDATE` so returning Google users get their role preserved.

**Policies**: Public SELECT, self-only UPDATE, self-only INSERT.

### `public.subjects`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `name` | TEXT | |
| `icon` | TEXT | Emoji or icon key |
| `description` | TEXT | |
| `enrolled_count` | INTEGER | |
| `created_at` | TIMESTAMPTZ | |

### `public.teachers`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `name` | TEXT | |
| `subject_id` | TEXT FK → subjects | |
| `teaching_style` | TEXT | |
| `description` | TEXT | |
| `avatar_url` | TEXT | |
| `personality_prompt` | TEXT | System prompt injected into chat |
| `voice_id` | TEXT | References voice in data/voices/ |
| `created_at` | TIMESTAMPTZ | |

### `public.resources`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `subject_id` | TEXT FK → subjects | |
| `title` | TEXT | |
| `type` | TEXT | `'pdf'`, `'pptx'`, `'note'`, etc. |
| `description` | TEXT | |
| `content` | TEXT | Raw extracted text |
| `created_at` | TIMESTAMPTZ | |

### `public.chats`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto-generated |
| `question` | TEXT | Student's question |
| `category` | TEXT | LLM-classified subject category |
| `time` | TEXT | Human-readable time string |
| `timestamp` | TIMESTAMPTZ | For ordering |
| `teacher_id` | TEXT FK → teachers | Which teacher clone was used |

### `public.documents`
| Column | Type | Notes |
|---|---|---|
| `file_id` | UUID PK | |
| `filename` | TEXT | |
| `chunk_count` | INTEGER | Number of ChromaDB chunks |
| `timestamp` | TIMESTAMPTZ | |
| `status` | TEXT | `'ingested'`, `'error'`, etc. |
| `subject_id` | TEXT FK → subjects | |

### `public.voices`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Matches voice_id in data/voices/ |
| `filename` | TEXT | Audio file name |
| `created_at` | TIMESTAMPTZ | |

**Current records**: `dr-rao`, `ms-priya`, `prof-sharma`, `andrew-ml`, `david-c`, `erik-adsa`, `grant-llm`

**Policies**: Public SELECT; admin-only INSERT (checked via `profiles.role = 'admin'`).

---

## 🔐 Security Notes

- **Google Client ID**: `26174274615-fnhavqrko3qmncf7pqjcvl1qfre12q7m.apps.googleusercontent.com`
- **Supabase Project**: `yowyjembzbekkkvmhhie.supabase.co`
- **Authorized redirect URI** (Google Cloud Console): `https://yowyjembzbekkkvmhhie.supabase.co/auth/v1/callback`
- **Allowed redirect URL** (Supabase): `http://localhost:5173`
- The backend uses `SUPABASE_SERVICE_ROLE_KEY` (never exposed to the frontend).
- The frontend uses `VITE_SUPABASE_ANON_KEY` (publishable key, RLS enforced).
- All dashboard routes are behind `ProtectedRoute` — unauthenticated users are always redirected to `/login`.

---

## 📋 Quick Reference

### Start Commands
| Task | Command |
|---|---|
| Start backend | `uvicorn main:app --reload` (in `backend/`) |
| Start frontend | `npm run dev` (in `frontend/`) |
| Run Ollama | `ollama serve` |
| Pull Ollama models | `ollama pull llama3 nomic-embed-text` |
| Run DB migrations | Paste SQL files into Supabase SQL Editor chronologically |

### Voice Cloning Pipeline Commands
| Task | Command (run from `backend/`) |
|---|---|
| Extract teacher voices | `PYTHONIOENCODING="utf-8" venv/bin/python scripts/extract_teacher_voices.py` |
| Test clone quality | `PYTHONIOENCODING="utf-8" venv/bin/python scripts/test_clone.py` |
| Check voice quality | `PYTHONIOENCODING="utf-8" venv/bin/python scripts/check_voice_quality.py` |
| Transcribe lectures (Phase 2) | `PYTHONIOENCODING="utf-8" venv/bin/python scripts/transcribe_lectures.py --model medium` |
| Ingest transcripts (Phase 2) | `PYTHONIOENCODING="utf-8" venv/bin/python scripts/ingest_lecture_transcripts.py` |
| Seed subjects & default teachers | `PYTHONIOENCODING="utf-8" venv/bin/python scripts/seed_subjects.py` |
| Clean old placeholder subjects | `PYTHONIOENCODING="utf-8" venv/bin/python scripts/delete_old_subjects.py` |
| Batch ingest local subject documents | `PYTHONIOENCODING="utf-8" venv/bin/python scripts/ingest_local_documents.py` |

> **macOS Note**: Prefix commands with `PYTHONIOENCODING="utf-8"` or ensure your zsh locale environment is configured for UTF-8 to ensure proper terminal stream rendering.

### Install Notes
```bash
# Backend venv (from backend/):
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Verify GPU (MPS):
python3 -c "import torch; print('MPS:', torch.backends.mps.is_available())"
```

### Demo Accounts (Mock Path — no real Supabase needed)
| Role | Email | Password |
|---|---|---|
| Student | `student@teacherclone.edu` | `password123` |
| Teacher | `dr.rao@teacherclone.edu` | `password123` |
| Admin | `admin@teacherclone.edu` | `password123` |

---

## 🗺️ What's Done vs What's Next

### Phase 1 — Voice Cloning ✅ COMPLETE
- [x] Voice extraction pipeline (`voice_extraction_service.py`) with per-teacher audio tuning
- [x] WebRTC VAD sustained-speech filter (rejects music/noise)
- [x] EBU R128 loudnorm normalization on all voice references
- [x] PyTorch with MPS backend installed and verified on macOS/Apple Silicon
- [x] XTTS-v2 configured for GPU acceleration via MPS (with CUDA fallback handling)
- [x] All 4 teacher voices cloned and tested on Apple Silicon (MPS/Metal)
- [x] `teacher_service.py` updated with default teachers + subjects (upsert-safe seeding)
- [x] Supabase `public.voices` + `public.teachers` + `public.subjects` upserted

### Phase 2 — Transcription & RAG ✅ COMPLETE
- [x] Run `transcribe_lectures.py` — Whisper transcribes each MP4 locally on GPU (`base` model)
  - Outputs: `data/transcripts/{voice_id}_transcript.txt`
  - Ollama (`llama3.2:1b`) extracts personality prompts from transcripts
  - Profiles saved to `data/transcripts/{voice_id}_profile.json`
- [x] Run `ingest_lecture_transcripts.py` — chunks transcripts → ChromaDB
  - Chunks: 148 total chunks generated using overlap splitting
  - Embeddings: Generated locally using Ollama (`nomic-embed-text`)
  - Subject mapping: andrew-ml→AI, david-c→FSD, erik-adsa→DAA, grant-llm→TOC
  - Records in Supabase `public.documents`

### Phase 3 — Custom Teacher Cloning (Clone Studio) & Dynamic Library Ingest ✅ COMPLETE
- [x] Background cloning pipeline (`clone_service.py` + `clone.py`) with automatic video saving, voice extraction, Whisper transcription, Ollama prompt generation, and Supabase seeding.
- [x] Admin/Teacher frontend Clone Studio dashboard (`CloneStudio.jsx`) to build, poll, preview, edit, and delete custom AI clones.
- [x] Subject-specific folder structure under `data/documents/{subject_id}/` for library materials.
- [x] Text sanitization (null byte removal) and text preview limit configuration (12k chars) for `public.resources` database row-limit safety.
- [x] Full library resource upload, ingestion, and deletion lifecycle management (UI + backend vector/DB purging).

### Phase 4 — Feature Extraction & Refinement (Future)
- [ ] Extract teaching-specific features from transcripts (vocabulary level, analogy patterns, pacing)
- [ ] Use features to auto-generate/refine personality prompts per teacher
- [ ] Fine-tune or adapt XTTS-v2 for longer-form coherent speech

---

## 📚 Additional Resources
- FastAPI: https://fastapi.tiangolo.com/
- ChromaDB: https://docs.trychroma.com/
- React: https://react.dev/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase JS: https://supabase.com/docs/reference/javascript/
- Ollama: https://ollama.ai/
- Coqui TTS / XTTS-v2: https://github.com/coqui-ai/TTS
- Gemini API: https://ai.google.dev/
- PyTorch MPS acceleration: https://pytorch.org/docs/stable/notes/mps.html

---

**Maintained By**: TeacherClone Team
**License**: MIT