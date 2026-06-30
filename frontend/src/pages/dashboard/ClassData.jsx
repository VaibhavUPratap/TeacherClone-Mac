import React, { useState, useEffect } from 'react';
import { BarChart3, Users, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { apiRequest } from '../../api/api';

export default function ClassData() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await apiRequest("/dashboard");
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  };

  // Mock chart data if real data is sparse, or use recent questions count
  const chartData = [
    { name: 'Mon', engagement: 4000 },
    { name: 'Tue', engagement: 3000 },
    { name: 'Wed', engagement: 2000 },
    { name: 'Thu', engagement: 2780 },
    { name: 'Fri', engagement: 1890 },
    { name: 'Sat', engagement: 2390 },
    { name: 'Sun', engagement: 3490 },
  ];

  if (loading) return <div className="loading-state"><Loader2 className="animate-spin" /> Loading Class Data...</div>;

  return (
    <div className="class-data-page fade-in">
      <header className="page-header">
        <div className="header-text">
          <h2>Classroom Data</h2>
          <p>Analytics and engagement insights from your students</p>
        </div>
      </header>

      <div className="analytics-grid">
        <motion.div className="chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="chart-header">
            <h3><TrendingUp size={18} /> Engagement Over Time</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEngage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  stroke="var(--color-subtle)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    background: 'var(--color-paper-3)', 
                    border: '1px solid var(--color-rule)',
                    borderRadius: '8px'
                  }}
                  itemStyle={{ color: 'var(--color-ink)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="engagement" 
                  stroke="var(--color-accent)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorEngage)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <div className="side-stats">
          <div className="stat-item">
            <div className="stat-icon purple"><Users size={20} /></div>
            <div>
              <p className="label">Total Questions</p>
              <h4>{stats?.total_questions || 0}</h4>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon blue"><BarChart3 size={20} /></div>
            <div>
              <p className="label">Top Topic</p>
              <h4>{stats?.top_topics?.[0] || "None"}</h4>
            </div>
          </div>
          <div className="stat-item alert">
            <div className="stat-icon orange"><AlertTriangle size={20} /></div>
            <div>
              <p className="label">Weak Areas</p>
              <h4>{stats?.weak_areas?.length || 0} Topics Identified</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {stats?.recent_questions?.length > 0 ? (
            stats.recent_questions.map((q, i) => (
              <div key={i} className="activity-row">
                <span className="time">{q.time}</span>
                <span className="question">{q.question}</span>
                <span className="badge">{q.category}</span>
              </div>
            ))
          ) : (
            <p className="no-data">No recent activity found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
