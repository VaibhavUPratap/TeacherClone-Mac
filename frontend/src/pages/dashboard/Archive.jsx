import React, { useState, useEffect } from 'react';
import { Archive as ArchiveIcon, Search, Filter, MoreHorizontal, File, MessageSquare, Clock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiRequest } from '../../api/api';

export default function Archive() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await apiRequest("/chat/history?limit=100");
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-state"><Loader2 className="animate-spin" /> Loading Archive...</div>;

  return (
    <div className="archive-page fade-in">
      <header className="page-header">
        <div className="header-text">
          <h2>Learning Archive</h2>
          <p>Historical chat interactions and doubt resolutions</p>
        </div>
      </header>

      <div className="archive-controls">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search your past questions..." />
        </div>
        <button className="filter-btn"><Filter size={18} /> Filter</button>
      </div>

      <div className="archive-grid">
        {history.length > 0 ? (
          history.map((chat, i) => (
            <motion.div 
              key={i} 
              className="archive-card"
              whileHover={{ scale: 1.02 }}
            >
              <div className="card-top">
                <div className="folder-icon purple">
                  <MessageSquare size={22} />
                </div>
                <div className="category-tag">{chat.category}</div>
              </div>
              <div className="card-info">
                <h3>{chat.question}</h3>
                <div className="meta">
                  <span className="time"><Clock size={14} /> {chat.time}</span>
                </div>
              </div>
              <div className="card-footer">
                <button className="btn-text">View Session</button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="no-history">
            <p>No chat history found. Start a conversation with a teacher!</p>
          </div>
        )}
      </div>
    </div>
  );
}
