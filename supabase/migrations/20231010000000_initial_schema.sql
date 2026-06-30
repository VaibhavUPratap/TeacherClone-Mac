-- Supabase Schema for TeacherClone

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Subjects table
CREATE TABLE public.subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    enrolled_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to subjects" ON public.subjects 
    FOR SELECT USING (true);

-- 2. Teachers table
CREATE TABLE public.teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject_id TEXT REFERENCES public.subjects(id) ON DELETE SET NULL,
    teaching_style TEXT,
    description TEXT,
    avatar_url TEXT,
    personality_prompt TEXT,
    voice_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance (FK indexing)
CREATE INDEX idx_teachers_subject_id ON public.teachers(subject_id);

-- Enable RLS
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to teachers" ON public.teachers 
    FOR SELECT USING (true);

-- 3. Resources table
CREATE TABLE public.resources (
    id TEXT PRIMARY KEY,
    subject_id TEXT REFERENCES public.subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT,
    description TEXT,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance (FK indexing)
CREATE INDEX idx_resources_subject_id ON public.resources(subject_id);

-- Enable RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to resources" ON public.resources 
    FOR SELECT USING (true);

-- 4. Chats (History) table
CREATE TABLE public.chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    category TEXT,
    time TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    teacher_id TEXT REFERENCES public.teachers(id) ON DELETE SET NULL
);

-- Indexes for performance (FK indexing and sorting optimization)
CREATE INDEX idx_chats_teacher_id ON public.chats(teacher_id);
CREATE INDEX idx_chats_timestamp ON public.chats(timestamp DESC);

-- Enable RLS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to chats" ON public.chats 
    FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to chats" ON public.chats 
    FOR INSERT WITH CHECK (true);

-- 5. Documents table (for RAG ingested files)
CREATE TABLE public.documents (
    file_id UUID PRIMARY KEY,
    filename TEXT NOT NULL,
    chunk_count INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to documents" ON public.documents 
    FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to documents" ON public.documents 
    FOR INSERT WITH CHECK (true);

