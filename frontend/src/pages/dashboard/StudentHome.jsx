import React, { useState, useEffect } from "react";
import { apiRequest } from "../../api/api";
import { 
  GraduationCap, 
  Sparkles, 
  BookOpen, 
  Clock, 
  Activity, 
  MessageSquare, 
  Zap, 
  Target, 
  ArrowRight,
  UserCheck,
  Flame,
  Atom,
  Binary,
  Code,
  Beaker,
  Brain,
  Database,
  Cpu,
  Sigma
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

// Mapping string icons to Lucide components for the subject grid
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

export default function StudentHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumeTeacher, setResumeTeacher] = useState(null);

  const displayName = user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'Student';

  useEffect(() => {
    fetchDashboardData();
    
    // Check if there's a previously active teacher to resume chatting with
    const savedTeacher = localStorage.getItem('activeTeacher');
    if (savedTeacher) {
      try {
        setResumeTeacher(JSON.parse(savedTeacher));
      } catch (e) {
        console.error("Error parsing activeTeacher:", e);
      }
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch subjects
      const subjectsData = await apiRequest("/dashboard/subjects");
      setSubjects(subjectsData);

      // Fetch all teachers across all subjects and deduplicate by id
      const teacherPromises = subjectsData.map(s =>
        apiRequest(`/dashboard/teachers/${s.id}`).catch(() => [])
      );
      const teacherResults = await Promise.all(teacherPromises);
      const allTeachers = Object.values(
        teacherResults.flat().reduce((acc, t) => {
          acc[t.id] = t;
          return acc;
        }, {})
      );
      setTeachers(allTeachers);
    } catch (err) {
      console.error("Error fetching student dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherClick = (teacher) => {
    localStorage.setItem('activeTeacher', JSON.stringify(teacher));
    navigate('/dashboard/interaction');
  };

  const handleSubjectClick = (subjectId) => {
    localStorage.setItem('selectedSubjectId', subjectId);
    navigate('/dashboard/subjects');
  };

  if (loading) {
    return <div className="loading-state">Loading your dashboard...</div>;
  }

  return (
    <div className="student-home-container">
      {/* Welcome Banner */}
      <motion.div 
        className="welcome-banner-card"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="welcome-banner-glow" />
        <div className="welcome-banner-content">
          <div className="badge-welcome">
            <Sparkles size={14} className="text-yellow-400" />
            <span>AI-Powered Classroom</span>
          </div>
          <h1>Welcome back, <span>{displayName}</span>!</h1>
          <p>Ready to unlock your potential today? Select a subject or continue studying with your personalized AI Teacher Clones.</p>
        </div>
      </motion.div>

      {/* Metrics Row */}
      <div className="quick-stats-grid">
        <motion.div 
          className="stat-metric-card"
          whileHover={{ y: -3 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="metric-header text-amber">
            <Flame size={20} />
            <span>Streak</span>
          </div>
          <h3>5 Days</h3>
          <p className="trend-text">Top 15% this week</p>
        </motion.div>

        <motion.div 
          className="stat-metric-card"
          whileHover={{ y: -3 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="metric-header text-purple">
            <Clock size={20} />
            <span>Hours Studied</span>
          </div>
          <h3>24.5 hrs</h3>
          <p className="trend-text">Goal: 30 hrs/month</p>
        </motion.div>

        <motion.div 
          className="stat-metric-card"
          whileHover={{ y: -3 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="metric-header text-blue">
            <MessageSquare size={20} />
            <span>Doubts Resolved</span>
          </div>
          <h3>128</h3>
          <p className="trend-text">+4 from yesterday</p>
        </motion.div>

        <motion.div 
          className="stat-metric-card"
          whileHover={{ y: -3 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="metric-header text-green">
            <Target size={20} />
            <span>Avg Mastery</span>
          </div>
          <h3>72%</h3>
          <p className="trend-text">+5% improvement</p>
        </motion.div>
      </div>

      <div className="home-dashboard-layout">
        {/* Left Column: Subjects & Quick Jump */}
        <div className="home-left-col">
          <div className="section-title-wrapper">
            <h2>Your Enrolled <span>Subjects</span></h2>
            <p>Access curated materials and previous year papers.</p>
          </div>
          
          <div className="home-subjects-list-grid">
            {subjects.map((sub, i) => {
              const Icon = IconMap[sub.icon] || BookOpen;
              return (
                <motion.div 
                  key={sub.id} 
                  className="home-subject-item-card"
                  onClick={() => handleSubjectClick(sub.id)}
                  whileHover={{ x: 4, borderColor: 'var(--color-accent)' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="home-subject-left">
                    <div className="home-subject-icon-box">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h4>{sub.name}</h4>
                      <p>{sub.description}</p>
                    </div>
                  </div>
                  <div className="home-subject-arrow">
                    <ArrowRight size={16} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Resume Study & Clones list */}
        <div className="home-right-col">
          {resumeTeacher && (
            <motion.div 
              className="resume-learning-card"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="resume-glow" />
              <div className="resume-card-body">
                <span className="section-label">Resume Learning</span>
                <div className="resume-teacher-header">
                  <img src={resumeTeacher.avatar_url} alt={resumeTeacher.name} />
                  <div>
                    <h3>{resumeTeacher.name}</h3>
                    <p>{resumeTeacher.teaching_style}</p>
                  </div>
                </div>
                <button 
                  className="resume-chat-btn"
                  onClick={() => handleTeacherClick(resumeTeacher)}
                >
                  <MessageSquare size={16} />
                  <span>Resume Conversation</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          <div className="section-title-wrapper mt-lg">
            <h2>Available <span>AI Teacher Clones</span></h2>
            <p>Chat and clarify your doubts instantly.</p>
          </div>

          <div className="teachers-quick-list">
            {teachers.map((teacher, i) => (
              <motion.div 
                key={teacher.id} 
                className="teacher-quick-card"
                whileHover={{ scale: 1.02, borderColor: 'var(--color-rule-active)' }}
                onClick={() => handleTeacherClick(teacher)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="teacher-quick-info">
                  <img src={teacher.avatar_url} alt={teacher.name} className="teacher-quick-avatar" />
                  <div className="teacher-quick-text">
                    <h4>{teacher.name}</h4>
                    <span className="teaching-style-tag">{teacher.teaching_style}</span>
                    <p>{teacher.description}</p>
                  </div>
                </div>
                <div className="teacher-quick-chat-badge">
                  <UserCheck size={16} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
