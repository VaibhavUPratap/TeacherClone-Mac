import React, { useState, useEffect, useRef } from "react";
import { apiRequest, streamRequest } from "../../api/api";
import { 
  Atom, 
  Binary, 
  Code, 
  Beaker, 
  Brain,
  Database,
  Cpu,
  Sigma,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Zap,
  BookOpen,
  Play,
  FileText,
  FileQuestion,
  ClipboardList,
  Layers,
  GraduationCap,
  Volume2,
  VolumeX,
  Loader2,
  Maximize2,
  Lightbulb,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Mapping string icons to Lucide components
const IconMap = {
  'Atom': Atom,
  'Binary': Binary,
  'Code': Code,
  'Beaker': Beaker,
  'Brain': Brain,
  'Database': Database,
  'Cpu': Cpu,
  'Sigma': Sigma,
};

const SubjectCard = ({ subject, onClick }) => {
  const Icon = IconMap[subject.icon] || BookOpen;
  
  return (
    <motion.div 
      className="subject-card"
      whileHover={{ scale: 1.02, y: -5, borderColor: 'var(--color-accent)' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(subject)}
    >
      <div className="subject-icon-wrapper">
        <Icon size={32} />
      </div>
      <div className="subject-info">
        <h3>{subject.name}</h3>
        <p>{subject.description}</p>
        <div className="subject-meta">
          <span className="enrolled">{subject.enrolled_count} Students</span>
          <ChevronRight size={16} />
        </div>
      </div>
    </motion.div>
  );
};

const ResourceCard = ({ resource, onClick }) => {
  return (
    <motion.div 
      className="resource-card"
      whileHover={{ scale: 1.02, y: -5, borderColor: 'var(--color-accent)' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(resource)}
    >
      <div className="resource-type-badge">{resource.type}</div>
      <div className="resource-icon">
        <FileText size={40} className="text-purple-400" />
      </div>
      <div className="resource-content">
        <h3>{resource.title}</h3>
        <p>{resource.description}</p>
        <button className="learn-now-btn">
          <Play size={14} fill="currentColor" />
          Explain with AI
        </button>
      </div>
    </motion.div>
  );
};

const TeacherSelectionCard = ({ teacher, onClick }) => {
  return (
    <motion.div 
      className="teacher-select-card"
      whileHover={{ scale: 1.05, borderColor: 'var(--color-success)' }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onClick(teacher)}
    >
      <img src={teacher.avatar_url} alt={teacher.name} />
      <div className="teacher-name-overlay">
        <span>{teacher.name}</span>
        <small>{teacher.teaching_style}</small>
      </div>
    </motion.div>
  );
};

export default function SubjectSelection() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState('subjects'); // 'subjects', 'resources', 'teacher-selection', 'explanation'
  const [subjects, setSubjects] = useState([]);
  const [resources, setResources] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Explanation and Interactive Chat State
  const [sessionMessages, setSessionMessages] = useState([]);
  const [followUpInput, setFollowUpInput] = useState("");
  const [currentSpeechId, setCurrentSpeechId] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchSubjects();
    return () => {
      // Clean up audio on unmount
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Auto-scroll chat to the bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sessionMessages]);

  const fetchSubjects = async () => {
    try {
      const data = await apiRequest("/dashboard/subjects");
      setSubjects(data);
      
      // Check for deep-linked subject from Home page
      const deepLinkedSubjectId = localStorage.getItem('selectedSubjectId');
      if (deepLinkedSubjectId) {
        const matchedSubject = data.find(s => s.id === deepLinkedSubjectId);
        if (matchedSubject) {
          // Fetch resources directly for deep link
          handleSubjectClick(matchedSubject);
        }
      }
    } catch (err) {
      console.error("Failed to fetch subjects:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectClick = async (subject) => {
    setLoading(true);
    setSelectedSubject(subject);
    try {
      const data = await apiRequest(`/dashboard/subjects/${subject.id}/resources`);
      setResources(data);
      setStep('resources');
    } catch (err) {
      console.error("Failed to fetch resources:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResourceClick = async (resource) => {
    setSelectedResource(resource);
    setLoading(true);
    try {
      const data = await apiRequest(`/dashboard/teachers/${selectedSubject.id}`);
      setTeachers(data);
      setStep('teacher-selection');
    } catch (err) {
      console.error("Failed to fetch teachers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherSelect = (teacher) => {
    setSelectedTeacher(teacher);
    setStep('explanation');
    generateExplanation(teacher, "standard");
  };

  const generateExplanation = async (teacher, mode = "standard") => {
    setIsExplaining(true);
    
    let prompt = `Explain this resource: ${selectedResource.title}. Content summary: ${selectedResource.content}`;
    
    if (mode === "summary") prompt = `Give me a quick high-level summary of: ${selectedResource.title}`;
    if (mode === "revision") prompt = `Give me exam-focused revision notes for: ${selectedResource.title}`;
    if (mode === "steps") prompt = `Break down ${selectedResource.title} into simple step-by-step concepts.`;
    if (mode === "numerical") prompt = `Focus on the numerical aspects and formulas in: ${selectedResource.title}`;

    const messageId = "init-explanation-" + Date.now();
    setSessionMessages([
      {
        id: messageId,
        sender: "teacher",
        text: "",
        isStreaming: true,
        timestamp: new Date()
      }
    ]);

    let fullText = "";
    try {
      await streamRequest(
        `/chat/stream?question=${encodeURIComponent(prompt)}&teacher_id=${teacher.id}`,
        (token) => {
          fullText += token;
          setSessionMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: fullText } : m));
        },
        () => {
          setIsExplaining(false);
          setSessionMessages(prev => prev.map(m => m.id === messageId ? { ...m, isStreaming: false } : m));
          if (autoSpeak) handleTTS(messageId, fullText, teacher.voice_id);
        }
      );
    } catch (err) {
      console.error("Explanation error:", err);
      setIsExplaining(false);
      setSessionMessages(prev => prev.map(m => m.id === messageId ? { ...m, isStreaming: false, text: m.text + " [Error generating explanation]" } : m));
    }
  };

  const handleFollowUpSubmit = async (e) => {
    e.preventDefault();
    if (!followUpInput.trim() || isExplaining) return;

    const question = followUpInput.trim();
    setFollowUpInput("");

    // Add student message to conversation
    const studentMsgId = "student-" + Date.now();
    const newStudentMsg = {
      id: studentMsgId,
      sender: "student",
      text: question,
      timestamp: new Date()
    };

    // Add streaming teacher message placeholder
    const teacherMsgId = "teacher-" + Date.now();
    const newTeacherMsg = {
      id: teacherMsgId,
      sender: "teacher",
      text: "",
      isStreaming: true,
      timestamp: new Date()
    };

    setSessionMessages(prev => [...prev, newStudentMsg, newTeacherMsg]);
    setIsExplaining(true);

    // Build history-aware prompt
    let prompt = `Regarding the resource "${selectedResource.title}" (Content: ${selectedResource.content}), the student has the following conversation history with you:\n`;
    sessionMessages.forEach(msg => {
      if (msg.text) {
        prompt += `${msg.sender === 'teacher' ? 'Teacher' : 'Student'}: ${msg.text}\n`;
      }
    });
    prompt += `Student: ${question}\n\n`;
    prompt += `Provide a helpful response maintaining your teaching style and character.`;

    let fullText = "";
    try {
      await streamRequest(
        `/chat/stream?question=${encodeURIComponent(prompt)}&teacher_id=${selectedTeacher.id}`,
        (token) => {
          fullText += token;
          setSessionMessages(prev => prev.map(m => m.id === teacherMsgId ? { ...m, text: fullText } : m));
        },
        () => {
          setIsExplaining(false);
          setSessionMessages(prev => prev.map(m => m.id === teacherMsgId ? { ...m, isStreaming: false } : m));
          if (autoSpeak) handleTTS(teacherMsgId, fullText, selectedTeacher.voice_id);
        }
      );
    } catch (err) {
      console.error("Streaming follow-up error:", err);
      setIsExplaining(false);
      setSessionMessages(prev => prev.map(m => m.id === teacherMsgId ? { ...m, isStreaming: false, text: m.text + " [Error generating reply]" } : m));
    }
  };

  const handleTTS = async (messageId, text, voiceId) => {
    if (isSpeaking && currentSpeechId === messageId && audioRef.current) {
      audioRef.current.pause();
      setIsSpeaking(false);
      setCurrentSpeechId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setIsSpeaking(true);
    setCurrentSpeechId(messageId);
    try {
      const response = await fetch(`${API_BASE_URL}/tts/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: text.substring(0, 1000), // Safety cap to avoid overloading TTS
          voice_id: voiceId,
          language: "en" 
        }),
      });

      if (!response.ok) throw new Error("TTS failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        setCurrentSpeechId(null);
      };
      await audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      setIsSpeaking(false);
      setCurrentSpeechId(null);
    }
  };

  if (loading && step === 'subjects') return <div className="loading-state">Loading subject universe...</div>;

  return (
    <div className="resource-learning-page">
      <AnimatePresence mode="wait">
        {step === 'subjects' && (
          <motion.div key="subjects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="section-header">
              <h1>Subject-Wise <span>Resources</span></h1>
              <p>Select a subject to access your intelligent study material.</p>
            </div>
            <div className="subjects-grid">
              {subjects.map(s => <SubjectCard key={s.id} subject={s} onClick={handleSubjectClick} />)}
            </div>
          </motion.div>
        )}

        {step === 'resources' && (
          <motion.div key="resources" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }}>
            <button className="back-link" onClick={() => {
              localStorage.removeItem('selectedSubjectId');
              setStep('subjects');
            }}>
              <ArrowLeft size={18} /> Back to Subjects
            </button>
            <div className="section-header">
              <h1>{selectedSubject.name} <span>Library</span></h1>
              <p>Everything you need to master {selectedSubject.name}.</p>
            </div>
            <div className="resources-grid">
              {resources.map(r => <ResourceCard key={r.id} resource={r} onClick={handleResourceClick} />)}
            </div>
          </motion.div>
        )}

        {step === 'teacher-selection' && (
          <motion.div key="teachers" className="teacher-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="teacher-selection-box">
              <h2>Explain this using which <span>teacher?</span></h2>
              <p>Every resource can be taught in a style that suits you.</p>
              <div className="teachers-selection-grid">
                {teachers.map(t => <TeacherSelectionCard key={t.id} teacher={t} onClick={handleTeacherSelect} />)}
              </div>
              <button className="close-btn" onClick={() => setStep('resources')}>Cancel</button>
            </div>
          </motion.div>
        )}

        {step === 'explanation' && (
          <motion.div key="explanation" className="explanation-view" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <div className="explanation-layout">
              <aside className="explanation-sidebar">
                <button className="back-link" onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.pause();
                    setIsSpeaking(false);
                  }
                  setStep('resources');
                }}>
                  <ArrowLeft size={18} /> Back to Resources
                </button>
                
                <div className="active-teacher-card">
                  <img src={selectedTeacher.avatar_url} alt="T" />
                  <div className="teacher-info">
                    <h4>{selectedTeacher.name}</h4>
                    <span>{selectedTeacher.teaching_style}</span>
                  </div>
                </div>

                <div className="smart-features">
                  <h5>Smart Learning Modes</h5>
                  <button onClick={() => generateExplanation(selectedTeacher, "summary")}>
                    <Zap size={16} /> Quick Summary
                  </button>
                  <button onClick={() => generateExplanation(selectedTeacher, "revision")}>
                    <GraduationCap size={16} /> Exam Revision
                  </button>
                  <button onClick={() => generateExplanation(selectedTeacher, "steps")}>
                    <Layers size={16} /> Step-by-Step
                  </button>
                  <button onClick={() => generateExplanation(selectedTeacher, "numerical")}>
                    <Target size={16} /> Numerical Focus
                  </button>
                </div>

                <div className="tts-control">
                  <button onClick={() => {
                    const latestTeacherMsg = [...sessionMessages].reverse().find(m => m.sender === 'teacher');
                    if (latestTeacherMsg) {
                      handleTTS(latestTeacherMsg.id, latestTeacherMsg.text, selectedTeacher.voice_id);
                    }
                  }}>
                    {isSpeaking ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    {isSpeaking ? "Stop Speaking" : "Listen to Explanation"}
                  </button>
                  <label className="auto-speak">
                    <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} />
                    Auto-play voice
                  </label>
                </div>
              </aside>

              <main className="explanation-content">
                <div className="content-header">
                  <div className="resource-tag">{selectedResource.type}</div>
                  <h3>{selectedResource.title}</h3>
                </div>
                
                <div className="explanation-chat-area">
                  {sessionMessages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`explanation-msg-bubble ${msg.sender === 'teacher' ? 'teacher-bubble' : 'student-bubble'}`}
                    >
                      <div className="bubble-header">
                        <span className="sender-name">
                          {msg.sender === 'teacher' ? selectedTeacher.name : 'You'}
                        </span>
                        {msg.sender === 'teacher' && msg.text && (
                          <button 
                            className={`bubble-speak-btn ${currentSpeechId === msg.id && isSpeaking ? 'speaking' : ''}`}
                            onClick={() => handleTTS(msg.id, msg.text, selectedTeacher.voice_id)}
                            title="Speak message"
                          >
                            {currentSpeechId === msg.id && isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          </button>
                        )}
                      </div>
                      
                      <div className="bubble-text">
                        {msg.isStreaming && !msg.text ? (
                          <div className="explaining-loader">
                            <Loader2 size={18} className="animate-spin" />
                            <span>Thinking...</span>
                          </div>
                        ) : (
                          msg.text.split('\n').map((line, i) => (
                            <p key={i}>{line}</p>
                          ))
                        )}
                        {msg.isStreaming && msg.text && <span className="cursor-blink">|</span>}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleFollowUpSubmit} className="explanation-input-area">
                  <div className="explanation-input-wrapper">
                    <input 
                      type="text" 
                      placeholder={`Ask ${selectedTeacher.name} a follow-up question...`}
                      value={followUpInput}
                      onChange={(e) => setFollowUpInput(e.target.value)}
                      disabled={isExplaining}
                    />
                    <button 
                      type="submit" 
                      className="explanation-send-btn"
                      disabled={!followUpInput.trim() || isExplaining}
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                  </div>
                </form>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
