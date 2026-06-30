from __future__ import annotations
import httpx
import json
from config import settings, supabase
from .knowledge_base import get_keyword_answer
from .vector_service import vector_service
from datetime import datetime

# Removed global CHAT_HISTORY list in favor of MongoDB persistence

FORMATTING_INSTRUCTION = (
    "\n\nFORMATTING RULES FOR COMPATIBILITY WITH UI:\n"
    "- Do NOT use markdown symbols like '**' or '*' for bold/italic text, '#' for headers, or backticks '`' for inline code. The UI does not render markdown. Use clean double quotes (e.g. \"Linear Regression\") or clean UPPERCASE for titles.\n"
    "- Use simple bullets like '•' or numbering (e.g. '1.', '2.') for list items.\n"
    "- ALWAYS separate paragraphs with exactly double newlines (\\n\\n) so the UI splits and renders them as separate paragraphs.\n"
    "- Use custom math widget blocks for mathematical equations or complex symbols like: genui{\"math_block_widget_always_prefetch_v2\": {\"content\": \"<formula>\"}} (e.g., genui{\"math_block_widget_always_prefetch_v2\": {\"content\": \"E = mc^2\"}})\n"
    "- Use chart widget blocks to represent data visualization or plots like: genui{\"chart_widget\": {\"title\": \"<visualization description>\"}}"
)

class ChatService:
    """Service to handle chat logic using either OpenAI or Ollama."""

    def __init__(self):
        self.gemini_key = settings.GEMINI_API_KEY
        self.gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.gemini_key}"
        self.ollama_url = f"{settings.OLLAMA_BASE_URL}/api/chat"
        self.use_ollama = settings.USE_OLLAMA

    def generate_answer(self, question: str) -> dict:
        """
        Generates an answer using keywords first, then falls back to LLM with topic validation and categorization.
        """
        # Step 1: Validate Topic and Identify Category
        is_on_topic, category = self._validate_and_categorize(question)
        
        # Log to history in Supabase
        if supabase is not None:
            try:
                supabase.table("chats").insert({
                    "question": question,
                    "category": category,
                    "time": datetime.now().strftime("%I:%M %p"),
                    "timestamp": datetime.now().isoformat()
                }).execute()
            except Exception as e:
                print(f"Supabase History Error: {e}")

        if not is_on_topic:
            return {
                "answer": "I'm sorry, I am designed to assist with educational and study-related questions only. How can I help you with your lessons today?",
                "source": "Topic Guard",
                "confidence": 0.0
            }

        # Step 2: Check Fast-Path Knowledge Base (Keywords)
        keyword_match = get_keyword_answer(question)
        if keyword_match:
            return keyword_match

        # Step 3: Generate Answer with LLM
        if self.use_ollama:
            return self._generate_with_ollama(question)
        else:
            return self._generate_with_gemini(question)

    def _validate_and_categorize(self, question: str) -> tuple[bool, str]:
        """
        Uses the LLM to determine if the question is education-related and categorize it.
        Returns (is_on_topic, category)
        """
        prompt = (
            "You are a classifier for an educational assistant. "
            "1. Determine if the input is related to education/learning (YES/NO). "
            "2. Provide a 1-2 word category for the subject (e.g., 'Biology', 'Math', 'History', or 'Off-topic'). "
            "Respond in JSON format: {\"on_topic\": boolean, \"category\": \"string\"}"
            f"\n\nUser Input: {question}"
        )

        try:
            if self.use_ollama:
                payload = {
                    "model": settings.OLLAMA_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "format": "json"
                }
                with httpx.Client(timeout=10.0) as client:
                    response = client.post(self.ollama_url, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    res = json.loads(data["message"]["content"])
            else:
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json"
                    }
                }
                with httpx.Client(timeout=15.0) as client:
                    response = client.post(self.gemini_url, json=payload, headers={"Content-Type": "application/json"})
                    response.raise_for_status()
                    data = response.json()
                    content_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    res = json.loads(content_text)

            return res.get("on_topic", True), res.get("category", "General")
        except Exception as e:
            print(f"Topic Validation Error: {e}")
            return True, "General"

    # ── RAG helpers ────────────────────────────────────────────────────────

    def _get_question_embedding(self, question: str) -> list[float] | None:
        """
        Embed the user's question. Since document ingestion is performed using
        Ollama's nomic-embed-text, the question embedding should prioritize the
        same local model to guarantee vector space and dimension compatibility (768).
        """
        # Try local Ollama embedding first (matching the ingestion model)
        try:
            url = f"{settings.OLLAMA_BASE_URL}/api/embeddings"
            payload = {"model": settings.OLLAMA_EMBED_MODEL, "prompt": question}
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
            return response.json()["embedding"]
        except Exception as e:
            print(f"Ollama Embedding Error: {e}. Trying Gemini fallback...")

        # Fallback to Gemini if Ollama is unavailable
        if self.gemini_key:
            try:
                # Use the active gemini-embedding-001 model instead of the deprecated text-embedding-004
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={self.gemini_key}"
                payload = {
                    "content": {
                        "parts": [{"text": question}]
                    }
                }
                with httpx.Client(timeout=10.0) as client:
                    response = client.post(url, json=payload)
                    response.raise_for_status()
                    return response.json()["embedding"]["values"]
            except Exception as e:
                print(f"Gemini Embedding Error: {e}")
        
        return None

    def _generate_with_ollama(self, question: str) -> dict:
        """
        RAG-aware Ollama generation.

        Flow:
          1. Embed the question with nomic-embed-text.
          2. Retrieve top-3 relevant chunks from ChromaDB.
          3. If chunks found  → build a context-injected prompt and call llama3.
          4. If no chunks     → return a clear "no data" message (never hallucinate).
        """
        try:
            # ── Step 1: Embed the question ───────────────────────────────────
            query_embedding = self._get_question_embedding(question)

            # ── Step 2: Retrieve context from vector DB ──────────────────────
            context_chunks: list[str] = []
            if query_embedding is not None:
                context_chunks = vector_service.query_similar(
                    query_embedding=query_embedding,
                    n_results=3,
                )

            # ── Step 3: Guard — no context found ────────────────────────────
            if not context_chunks:
                return {
                    "answer": (
                        "No relevant data found in knowledge base. "
                        "Please upload study materials first using the /ingest/file endpoint."
                    ),
                    "source": "RAG Guard",
                    "confidence": 0.0,
                }

            # ── Step 4: Build structured prompt ─────────────────────────────
            context_text = "\n\n---\n\n".join(
                f"[Chunk {i + 1}]\n{chunk}"
                for i, chunk in enumerate(context_chunks)
            )
            rag_prompt = (
                "Answer the question using ONLY the context provided below. "
                "If the context does not contain enough information, say so honestly.\n\n"
                f"Context:\n{context_text}\n\n"
                f"Question:\n{question}"
            )

            # ── Step 5: Call llama3 ──────────────────────────────────────────
            payload = {
                "model": settings.OLLAMA_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are TeacherClone, a helpful teaching assistant. "
                            "Answer questions strictly based on the provided context. "
                            "Do not make up information not present in the context."
                            + FORMATTING_INSTRUCTION
                        ),
                    },
                    {"role": "user", "content": rag_prompt},
                ],
                "stream": False,
            }

            with httpx.Client(timeout=60.0) as client:
                response = client.post(self.ollama_url, json=payload)
                response.raise_for_status()
                data = response.json()

            answer = data["message"]["content"]

            return {
                "answer": answer,
                "source": f"RAG · Ollama ({settings.OLLAMA_MODEL})",
                "confidence": 0.92,
            }

        except Exception as e:
            print(f"Ollama RAG Error: {e}. Falling back to Gemini...")
            return self._generate_with_gemini(question)

    def _generate_with_gemini(self, question: str) -> dict:
        """
        Generates an answer using Gemini 2.5 Flash model.
        """
        try:
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": (
                                    "You are a helpful teaching assistant named TeacherClone. "
                                    "You ONLY answer questions related to education, school, and learning. "
                                    "If a question is off-topic, politely refuse and redirect to studies.\n\n"
                                    f"Student Question: {question}"
                                    + FORMATTING_INSTRUCTION
                                )
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.7
                }
            }
            with httpx.Client(timeout=30.0) as client:
                response = client.post(self.gemini_url, json=payload, headers={"Content-Type": "application/json"})
                response.raise_for_status()
                data = response.json()
                answer = data["candidates"][0]["content"]["parts"][0]["text"]
            
            return {
                "answer": answer,
                "source": "Gemini 2.5 Flash",
                "confidence": 0.95
            }
        except Exception as e:
            print(f"Gemini Error: {e}")
            return {
                "answer": f"I encountered an error while processing your request: {e}",
                "source": "Error System",
                "confidence": 0.0
            }

    async def stream_answer(self, question: str, teacher_id: str = None):
        """
        Generates a streaming answer using Ollama and yields SSE formatted chunks.
        Injects teacher personality and RAG context if available.
        """
        from services.teacher_service import teacher_service
        
        # 1. Retrieve Teacher Persona
        teacher = None
        if teacher_id:
            teacher = teacher_service.get_teacher_by_id(teacher_id)
        
        system_prompt = (
            "You are TeacherClone, a helpful teaching assistant. "
            "You ONLY answer questions related to education, school, and learning. "
            "If a question is off-topic, politely refuse and redirect to studies."
        )
        
        if teacher:
            system_prompt = teacher["personality_prompt"]
            
            # Load profile features if available to refine the system prompt
            from pathlib import Path
            voice_id = teacher.get("voice_id") or teacher_id
            profile_path = Path("data/transcripts") / f"{voice_id}_profile.json"
            if profile_path.exists():
                try:
                    with open(profile_path, "r", encoding="utf-8") as f:
                        profile = json.load(f)
                    
                    extra_constraints = []
                    vocab = profile.get("vocabulary_level")
                    if vocab == "Beginner":
                        extra_constraints.append("Explain concepts using simple, beginner-friendly language and avoid unnecessary technical jargon.")
                    elif vocab == "Advanced":
                        extra_constraints.append("Explain concepts using advanced, mathematically rigorous, and technically detailed terms.")
                    
                    freq = profile.get("analogy_frequency")
                    style = profile.get("analogy_style")
                    if freq == "High" and style:
                        extra_constraints.append(f"Frequently use analogies to clarify abstract concepts, drawing specifically from: {style}.")
                    elif freq == "Medium" and style:
                        extra_constraints.append(f"Occasionally use analogies when helpful to clarify abstract concepts, drawing from: {style}.")
                    elif freq == "Low":
                        extra_constraints.append("Focus on direct, literal explanations and avoid metaphors or analogies.")

                    if extra_constraints:
                        system_prompt += "\n\nCRITICAL INSTRUCTIONS FOR YOUR STYLE:\n" + "\n".join(f"- {inst}" for inst in extra_constraints)
                except Exception as e:
                    print(f"Error loading profile features for prompt refinement: {e}")

        # 2. Retrieve Context (RAG)
        context_text = ""
        try:
            query_embedding = self._get_question_embedding(question)
            if query_embedding:
                subject_id = teacher["subject_id"] if teacher else None
                context_chunks = vector_service.query_similar(
                    query_embedding=query_embedding,
                    n_results=3,
                    subject_id=subject_id
                )
                if context_chunks:
                    context_text = "\n\n---\n\n".join(
                        f"[Resource {i + 1}]\n{chunk}"
                        for i, chunk in enumerate(context_chunks)
                    )
        except Exception as e:
            print(f"RAG Retrieval Error in stream: {e}")

        # 3. Build Final Prompt
        system_prompt += FORMATTING_INSTRUCTION
        # We want the teacher to use the context but stay in character
        user_prompt = question
        if context_text:
            user_prompt = (
                f"Use the following lecture context to answer the student's question. "
                f"Maintain your teacher persona and explanation style as defined in your system prompt.\n\n"
                f"--- CONTEXT ---\n{context_text}\n\n"
                f"--- STUDENT QUESTION ---\n{question}"
            )

        # Log to history in Supabase
        if supabase is not None:
            try:
                supabase.table("chats").insert({
                    "question": question,
                    "category": teacher["subject_id"] if teacher else "General",
                    "time": datetime.now().strftime("%I:%M %p"),
                    "timestamp": datetime.now().isoformat(),
                    "teacher_id": teacher_id
                }).execute()
            except Exception as e:
                print(f"Supabase History Error (Stream): {e}")

        if not self.use_ollama and self.gemini_key:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key={self.gemini_key}"
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": user_prompt}]
                    }
                ],
                "systemInstruction": {
                    "parts": [{"text": system_prompt}]
                },
                "generationConfig": {
                    "temperature": 0.7
                }
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                try:
                    async with client.stream("POST", url, json=payload) as response:
                        response.raise_for_status()
                        buffer = ""
                        async for line in response.aiter_lines():
                            clean_line = line.strip()
                            if not clean_line:
                                continue
                            buffer += clean_line
                            
                            # Strip array/stream markers to extract a single object candidate
                            test_str = buffer
                            if test_str.startswith("["):
                                test_str = test_str[1:]
                            if test_str.startswith(","):
                                test_str = test_str[1:]
                            if test_str.endswith("]"):
                                test_str = test_str[:-1]
                            
                            test_str = test_str.strip()
                            try:
                                chunk_data = json.loads(test_str)
                                token = chunk_data["candidates"][0]["content"]["parts"][0].get("text", "")
                                yield f"data: {token}\n\n"
                                buffer = ""  # Reset buffer for the next chunk
                            except json.JSONDecodeError:
                                # Keep accumulating lines until we have a complete JSON object
                                continue
                            except (KeyError, IndexError):
                                # Path mismatch (e.g. usageMetadata), clear buffer to proceed
                                buffer = ""
                                continue
                except Exception as e:
                    print(f"Gemini Streaming Error: {e}")
                    yield f"data: Error: {str(e)}\n\n"
        else:
            url = f"{settings.OLLAMA_BASE_URL}/api/chat"
            payload = {
                "model": settings.OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "stream": True
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                try:
                    async with client.stream("POST", url, json=payload) as response:
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if not line:
                                continue
                            
                            try:
                                data = json.loads(line)
                                token = data.get("message", {}).get("content", "")
                                yield f"data: {token}\n\n"
                                
                                if data.get("done"):
                                    break
                            except json.JSONDecodeError:
                                continue
                except Exception as e:
                    print(f"Streaming Error: {e}")
                    yield f"data: Error: {str(e)}\n\n"

    def get_history(self, limit: int = 50) -> list:
        """Retrieves chat history from Supabase."""
        if supabase is not None:
            try:
                response = supabase.table("chats").select("*").order("timestamp", desc=True).limit(limit).execute()
                return response.data
            except Exception as e:
                print(f"Supabase Fetch Error: {e}")
        return []

chat_service = ChatService()
