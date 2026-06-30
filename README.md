# TeacherClone-Mac 🍎🍏
**Your AI-Powered Educational Companion (macOS/Apple Silicon Edition)**

TeacherClone-Mac is an intelligent tutoring assistant designed to help students master their subjects through interactive AI conversations. It leverages Retrieval-Augmented Generation (RAG) to provide context-aware answers based on uploaded study materials, ensuring high accuracy and preventing hallucinations. It features Google OAuth + email/password auth via Supabase, local text-to-speech using native macOS speech engines, analytics dashboards, and role-based access control.

This repository is optimized specifically for **macOS and Apple Silicon (M-series chips)**, leveraging **MPS (Metal Performance Shaders)** and native Metal hardware acceleration to achieve blazing-fast local audio cloning, native speech synthesis, and transcription speeds.

---

## 🚀 Key Features

- **📚 Intelligent RAG System**: Upload PDFs or PPTXs and get answers strictly based on the provided context using ChromaDB and Ollama.
- **🛡️ Topic Guard**: Built-in validation system that keeps the assistant focused on educational content, politely redirecting off-topic queries.
- **🎙️ Local Text-to-Speech (TTS)**: Ultra-low latency local speech synthesis leveraging native macOS system and Siri voices (Apple local speech synthesis via 'say' utility), saving VRAM and unified memory.
- **📊 Analytics Dashboard**: Track learning progress, identify weak areas, and view recent activity with a sleek management interface.
- **🔐 Secure Authentication**: Integrated with Supabase Auth (Email/Password + Google OAuth) for a safe and personalized user experience.
- **⚡ Real-time Streaming**: Token-by-token response streaming for a natural, low-latency conversation feel.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
- **Vector Database**: [ChromaDB](https://www.trychroma.com/) (Local RAG document retrieval)
- **Database**: [Supabase (PostgreSQL)](https://supabase.com/) (Historical Data)
- **AI Models**: 
  - [Ollama](https://ollama.com/) (llama3 & nomic-embed-text) - Primary local inference
  - [Google Gemini](https://ai.google.dev/) (Gemini 2.5 Flash) - Cloud fallback
- **TTS**: macOS native Speech Synthesis (`say` utility with Siri/system voices) for runtime speech, and Coqui XTTS-v2 for dynamic voice cloning extraction.
- **Auth**: Supabase Auth (JWT)

### Frontend
- **Framework**: [React 18](https://reactjs.org/)
- **Build Tool**: [Vite 5](https://vitejs.dev/)
- **Routing**: React Router v7
- **State Management**: React Hooks + Context API
- **Styling**: Vanilla CSS (Modern aesthetic with glassmorphism using OKLCH colours)
- **Auth Client**: `@supabase/supabase-js`

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com/) installed and running
- Supabase Project (for Authentication and PostgreSQL)

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```

### 3. Ollama Configuration
Ensure you have the required models pulled:
```bash
ollama pull llama3
ollama pull nomic-embed-text
```

### 4. Database Setup
Run the SQL migration files located in `supabase/migrations/` sequentially in your Supabase SQL Editor.

### 5. Environment Variables
Create a `.env` file in the `backend/` directory:
```env
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

Create a `.env` file in the `frontend/` directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:8000
```
*(Note: The app supports a mock fallback for `@teacherclone.edu` emails if Supabase credentials are not provided.)*

---

## 🏃 Running the Application

### Start Ollama (Required for AI features)
```bash
ollama serve
```

### Start Backend
Set the MPS fallback environment variable so unsupported GPU operators execute on the CPU seamlessly:
```bash
cd backend
PYTORCH_ENABLE_MPS_FALLBACK=1 uvicorn main:app --reload
```

### Start Frontend
```bash
cd frontend
npm run dev
```

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.