import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  BookOpen, 
  Brain, 
  MessageCircle, 
  Zap, 
  TrendingUp, 
  ChevronRight,
  Info,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StudentChat from "../../components/chat/StudentChat";

export default function TeacherInteraction() {
  const [activeTeacher, setActiveTeacher] = useState(null);
  const [activeSubject, setActiveSubject] = useState("");
  const chatRef = useRef(null);

  const [resources, setResources] = useState([]);

  useEffect(() => {
    const teacherData = localStorage.getItem('activeTeacher');
    if (teacherData) {
      const teacher = JSON.parse(teacherData);
      setActiveTeacher(teacher);
      setActiveSubject(teacher.subject_id.charAt(0).toUpperCase() + teacher.subject_id.slice(1));
    }
  }, []);

  useEffect(() => {
    if (activeTeacher?.subject_id) {
      fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/dashboard/subjects/${activeTeacher.subject_id}/resources`)
        .then(res => res.json())
        .then(data => setResources(data))
        .catch(err => console.error("Error fetching subject resources:", err));
    }
  }, [activeTeacher]);

  const handleQuickAction = (actionId) => {
    if (!chatRef.current) return;
    
    let prompt = "";
    switch(actionId) {
      case 'doubts': prompt = "Sir, I have a doubt regarding the latest topic. Can you help?"; break;
      case 'explain': prompt = `Can you explain the core concepts of ${activeSubject} that we covered yesterday?`; break;
      case 'numerical': prompt = "Could you help me solve a numerical problem related to this topic?"; break;
      case 'revise': prompt = "Can we do a quick 5-minute revision of what we've learned so far?"; break;
      default: prompt = "Hello Sir!";
    }
    
    chatRef.current.sendMessage(prompt);
  };

  const quickActions = [
    { id: 'doubts', label: 'Ask a Doubt', icon: MessageCircle, color: '#6366f1' },
    { id: 'explain', label: 'Explain Concept', icon: Brain, color: '#8b5cf6' },
    { id: 'numerical', label: 'Solve Numerical', icon: Zap, color: '#f59e0b' },
    { id: 'revise', label: 'Quick Revision', icon: BookOpen, color: '#10b981' },
  ];

  return (
    <div className="interaction-page fade-in">
      <div className="interaction-layout">
        {/* Left Column: Stats & Context */}
        <aside className="interaction-left">
          <motion.div 
            className="teacher-info-card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="teacher-header">
              <div className="avatar-glow-wrapper">
                <div className="avatar-glow" />
                <img src={activeTeacher?.avatar_url} alt={activeTeacher?.name} />
              </div>
              <div className="name-meta">
                <h2>{activeTeacher?.name}</h2>
                <span className="subject-badge">{activeSubject} Expert</span>
              </div>
            </div>
            <p className="teacher-bio">{activeTeacher?.description}</p>
            <div className="style-pills">
              <span className="pill">{activeTeacher?.teaching_style}</span>
              <span className="pill online">Active Now</span>
            </div>
          </motion.div>
 
          <motion.div 
            className="learning-metrics"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="metrics-header">
              <TrendingUp size={18} className="text-accent" />
              <h3>Progress Insights</h3>
            </div>
            <div className="metrics-list">
              <div className="metric-item">
                <span className="label">Topic Mastery</span>
                <div className="progress-bar">
                  <motion.div className="fill" initial={{ width: 0 }} animate={{ width: '72%' }} />
                </div>
                <span className="value">72%</span>
              </div>
              <div className="metric-item">
                <span className="label">Doubts Resolved</span>
                <span className="value badge">12</span>
              </div>
            </div>
          </motion.div>
 
          <div className="quick-actions-container">
            <h4 className="section-label">Common Requests</h4>
            <div className="quick-actions-grid">
              {quickActions.map((action) => (
                <motion.button
                  key={action.id}
                  className="action-btn"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleQuickAction(action.id)}
                >
                  <action.icon size={18} style={{ color: action.color }} />
                  <span>{action.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </aside>
 
        {/* Middle Column: The Chat Agent */}
        <main className="interaction-main">
          <StudentChat ref={chatRef} />
        </main>
 
        {/* Right Column: Knowledge & History */}
        <aside className="interaction-right">
          <motion.div 
            className="context-knowledge"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="context-header">
              <BookOpen size={18} />
              <h3>Lecture Context</h3>
            </div>
            <div className="knowledge-sources">
              {resources.length > 0 ? (
                resources.map((res, index) => (
                  <div key={res.id || index} className={`source-item ${index === 0 ? 'active' : ''}`}>
                    <div className="source-icon"><FileText size={14} /></div>
                    <div className="source-details">
                      <p className="source-name">{res.title || res.filename}</p>
                      <p className="source-meta">{index === 0 ? 'Currently in context' : 'Available'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", fontStyle: "italic", padding: "var(--space-sm) 0" }}>
                  No resources uploaded for this subject yet.
                </p>
              )}
            </div>
            <button className="view-all-link">
              View all resources <ChevronRight size={14} />
            </button>
          </motion.div>

          <motion.div 
            className="session-tip"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="tip-header">
              <Sparkles size={18} className="text-yellow" />
              <h3>AI Teacher Tip</h3>
            </div>
            <p className="tip-text">
              Try asking <strong>"{activeTeacher?.name}, explain Question 3 from yesterday's assignment"</strong> to see how I use class context.
            </p>
          </motion.div>

          <div className="restricted-notice">
            <Info size={14} />
            <span>Educational discussion mode only</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
