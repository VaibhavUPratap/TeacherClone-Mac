import React, { useRef, useState, useEffect } from "react";
import { 
  History, 
  BookOpen,
  Sparkles,
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StudentChat from "../../components/chat/StudentChat";
import { apiRequest } from "../../api/api";

export default function Conversations() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await apiRequest("/chat/history?limit=10");
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="conversations-page fade-in">
      <div className="chat-layout">
        {/* Left Column: History */}
        <aside className="chat-sidebar">
          <div className="sidebar-header">
            <History size={18} />
            <h3>Recent Chats</h3>
          </div>
          <div className="history-list">
            {loading ? (
              <div className="loading-small"><Loader2 className="animate-spin" size={16} /></div>
            ) : history.length > 0 ? (
              history.map((chat, i) => (
                <div key={chat.id} className={`history-item ${i === 0 ? 'active' : ''}`}>
                  <p className="item-title">{chat.question.substring(0, 25)}...</p>
                  <p className="item-date">{new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))
            ) : (
              <p className="no-history">No recent chats</p>
            )}
          </div>
        </aside>

        {/* Middle Column: Chat Area */}
        <main className="chat-main">
          <StudentChat onNewMessage={fetchHistory} />
        </main>

        {/* Right Column: Context/Sources */}
        <aside className="chat-context">
          <div className="sidebar-header">
            <BookOpen size={18} />
            <h3>Context</h3>
          </div>
          <div className="sources-content">
            <div className="source-card">
              <div className="source-badge">LIVE AI AGENT</div>
              <h4>Current Session</h4>
              <p>Your AI teacher is drawing knowledge from processed course materials and real-time context.</p>
            </div>
            <div className="source-card">
              <div className="source-badge">KNOWLEDGE BASE</div>
              <h4>References</h4>
              <p>Sources used in this conversation will appear here during long-form answers.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
