import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { Target, TrendingUp, AlertTriangle, CheckCircle, Zap, BookOpen, Clock, Activity, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StudentAnalytics() {
  const [activeTab, setActiveTab] = useState('overview');

  const performanceData = [
    { name: 'Mon', accuracy: 65, duration: 45 },
    { name: 'Tue', accuracy: 70, duration: 60 },
    { name: 'Wed', accuracy: 68, duration: 30 },
    { name: 'Thu', accuracy: 82, duration: 90 },
    { name: 'Fri', accuracy: 78, duration: 50 },
    { name: 'Sat', accuracy: 85, duration: 120 },
    { name: 'Sun', accuracy: 88, duration: 80 },
  ];

  const subjectStrengths = [
    { subject: 'Math', mastery: 85, fullMark: 100 },
    { subject: 'Physics', mastery: 65, fullMark: 100 },
    { subject: 'Chemistry', mastery: 50, fullMark: 100 },
    { subject: 'Programming', mastery: 90, fullMark: 100 },
    { subject: 'ML', mastery: 40, fullMark: 100 },
  ];

  const statCards = [
    { title: "Concepts Mastered", value: "34", icon: CheckCircle, color: "#10b981", trend: "+12% this week" },
    { title: "Current Streak", value: "5 Days", icon: Zap, color: "#f59e0b", trend: "Top 20% in class" },
    { title: "Doubts Resolved", value: "128", icon: Target, color: "#3b82f6", trend: "+4 from yesterday" },
    { title: "Learning Hours", value: "24.5h", icon: Clock, color: "#8b5cf6", trend: "This month" }
  ];

  const recommendations = [
    {
      type: "critical",
      title: "Revise Thermodynamics",
      desc: "You've missed 4 questions on this topic recently. Dr. Rao has a great 15-min visual breakdown.",
      subject: "Physics",
      action: "Start Revision"
    },
    {
      type: "warning",
      title: "Calculus Quiz Pending",
      desc: "Your mastery in integration by parts is dropping. Test your knowledge to maintain your streak.",
      subject: "Mathematics",
      action: "Take Quiz"
    },
    {
      type: "success",
      title: "Ahead of Schedule",
      desc: "You are mastering Programming 20% faster than the syllabus pace! Want to try advanced concepts?",
      subject: "Programming",
      action: "View Advanced"
    }
  ];

  return (
    <div className="student-analytics-page fade-in">
      <header className="student-analytics-header">
        <div>
          <h2>Your Learning Analytics</h2>
          <p>Track your progress, identify weak areas, and get personalized recommendations.</p>
        </div>
        <div className="student-analytics-tabs">
          {['overview', 'subjects', 'history'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`student-analytics-tab-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <div className="student-analytics-stats-grid">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div 
              key={i} 
              className="student-analytics-stat-card" 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="student-analytics-stat-card-header">
                <div 
                  className="student-analytics-stat-icon-wrapper"
                  style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
                >
                  <Icon size={22} />
                </div>
                <span className="student-analytics-stat-trend">{stat.trend}</span>
              </div>
              <p className="student-analytics-stat-title">{stat.title}</p>
              <h3 className="student-analytics-stat-value">{stat.value}</h3>
            </motion.div>
          )
        })}
      </div>

      <div className="student-analytics-content-grid">
        {/* Performance Chart */}
        <div className="student-analytics-chart-panel">
          <div className="student-analytics-chart-title">
            <Activity size={18} color="var(--color-success)" />
            <h3>Learning Consistency & Accuracy</h3>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--color-subtle)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-subtle)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: 'var(--color-paper-3)', border: '1px solid var(--color-rule)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--color-ink)' }}
                />
                <Area type="monotone" dataKey="accuracy" stroke="var(--color-success)" strokeWidth={3} fillOpacity={1} fill="url(#colorAcc)" name="Accuracy %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Skill Radar */}
        <div className="student-analytics-chart-panel">
          <div className="student-analytics-chart-title">
            <Target size={18} color="var(--color-accent)" />
            <h3>Skill Distribution</h3>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={subjectStrengths}>
                <PolarGrid stroke="var(--color-rule)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} />
                <Radar name="Mastery" dataKey="mastery" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.3} />
                <Tooltip 
                  contentStyle={{ background: 'var(--color-paper-3)', border: '1px solid var(--color-rule)', borderRadius: '8px' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="student-analytics-recommendations-section">
        <h3 className="student-analytics-recommendations-title">
          <BookOpen size={20} color="var(--color-accent)" />
          Smart Recommendations
        </h3>
        <div className="student-analytics-recommendations-grid">
          {recommendations.map((rec, i) => {
            const isCritical = rec.type === 'critical';
            const isWarn = rec.type === 'warning';
            
            let color = 'var(--color-success)'; 
            if (isCritical) color = 'oklch(60% 0.16 20)'; // Red/crimson
            if (isWarn) color = 'oklch(70% 0.18 60)'; // Amber/orange
            
            return (
              <div 
                key={i} 
                className="student-analytics-recommendation-card" 
                style={{ borderTop: `3px solid ${color}` }}
              >
                <div className="student-analytics-recommendation-header">
                  <span 
                    className="student-analytics-recommendation-subject" 
                    style={{ color: color }}
                  >
                    {rec.subject}
                  </span>
                  {isCritical && <AlertTriangle size={16} style={{ color: color }} />}
                  {isWarn && <TrendingUp size={16} style={{ color: color }} />}
                  {!isCritical && !isWarn && <Sparkles size={16} style={{ color: color }} />}
                </div>
                <h4 className="student-analytics-recommendation-title">{rec.title}</h4>
                <p className="student-analytics-recommendation-desc">{rec.desc}</p>
                <button 
                  className="student-analytics-recommendation-btn"
                  style={{
                    backgroundColor: `${color}15`,
                    color: color,
                    borderColor: `${color}30`
                  }}
                >
                  {rec.action}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}