import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { 
  Send, 
  Volume2, 
  Sparkles,
  Loader2,
  User,
  Bot,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { streamRequest } from "../../api/api";
import { MessageRenderer } from "./MessageRenderer";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const StudentChat = forwardRef((props, ref) => {
  const [activeTeacher, setActiveTeacher] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  
  const scrollRef = useRef(null);
  const audioRef = useRef(null);

  // Expose sendMessage to parent components
  useImperativeHandle(ref, () => ({
    sendMessage: (text) => {
      handleSend(text);
    }
  }));

  // Initialize teacher context
  useEffect(() => {
    const teacherData = localStorage.getItem('activeTeacher');
    if (teacherData) {
      const teacher = JSON.parse(teacherData);
      setActiveTeacher(teacher);
      setMessages([
        {
          role: "ai",
          text: `Hello! I am ${teacher.name}. I'll be your ${teacher.teaching_style} guide for ${teacher.subject_id.charAt(0).toUpperCase() + teacher.subject_id.slice(1)}. How can I help you with your studies today?`,
          id: Date.now()
        },
      ]);
    } else {
      // Fallback
      setMessages([
        {
          role: "ai",
          text: "Hello! Please select a teacher clone from the dashboard to start learning.",
          id: Date.now()
        },
      ]);
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (forcedText = null) => {
    const textToSend = forcedText || inputText;
    if (!textToSend.trim() || isStreaming || !activeTeacher) return;

    const userMsg = { role: "user", text: textToSend, id: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    const currentQuestion = textToSend;
    if (!forcedText) setInputText("");
    setIsStreaming(true);

    // Add empty AI message to start streaming into
    const aiMsgId = Date.now() + 1;
    setMessages((prev) => [...prev, { role: "ai", text: "", id: aiMsgId }]);

    let fullResponse = "";

    try {
      await streamRequest(
        `/chat/stream?question=${encodeURIComponent(currentQuestion)}&teacher_id=${activeTeacher.id}`,
        (token) => {
          fullResponse += token;
          setMessages((prev) => {
            return prev.map(msg => 
              msg.id === aiMsgId ? { ...msg, text: fullResponse } : msg
            );
          });
        },
        () => {
          setIsStreaming(false);
          if (autoSpeak && fullResponse) {
            handleTTS(fullResponse);
          }
        },
        (err) => {
          console.error("Stream error:", err);
          setIsStreaming(false);
          setMessages((prev) => [
            ...prev,
            { role: "ai", text: "I'm sorry, I encountered an error. Please try again or check if the server is running.", id: Date.now() },
          ]);
        }
      );
    } catch (err) {
      console.error("Fetch error:", err);
      setIsStreaming(false);
    }
  };

  const handleTTS = async (text) => {
    if (isSpeaking) {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsSpeaking(false);
        }
        return;
    }

    if (!activeTeacher) return;

    setIsSpeaking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tts/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            text: text.substring(0, 1000), // Safety cap
            voice_id: activeTeacher.voice_id || activeTeacher.id, 
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
        URL.revokeObjectURL(url);
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      setIsSpeaking(false);
    }
  };

  return (
    <div className="student-chat-container">
      <div className="chat-header-minimal">
        <div className="ai-status">
          {activeTeacher ? (
            <div className="teacher-badge-simple">
              <div className="status-indicator">
                <div className="status-dot pulse" />
              </div>
              <div className="header-info">
                <span className="teacher-name">{activeTeacher.name}</span>
                <span className="teacher-style-tag">AI Agent • {activeTeacher.teaching_style}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="status-dot"></div>
              <span>TeacherClone AI</span>
            </>
          )}
        </div>
        <div className="header-actions">
          <button 
            className={`action-toggle ${autoSpeak ? 'active' : ''}`}
            onClick={() => setAutoSpeak(!autoSpeak)}
            title={autoSpeak ? "Voice cloning enabled" : "Voice cloning disabled"}
          >
            {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </div>

      <div className="chat-messages-area" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div 
              key={msg.id} 
              className={`msg-group ${msg.role}`}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="msg-bubble-wrapper">
                <div className="msg-bubble">
                  <div className="msg-content">
                    {msg.text ? <MessageRenderer text={msg.text} /> : (isStreaming && msg.id === messages[messages.length - 1].id ? (
                      <div className="typing-dots">
                        <span></span><span></span><span></span>
                      </div>
                    ) : "")}
                  </div>
                  
                  {msg.role === "ai" && msg.text && !isStreaming && (
                    <div className="msg-actions">
                      <button 
                        className={`msg-action-btn ${isSpeaking ? 'active' : ''}`} 
                        onClick={() => handleTTS(msg.text)}
                        title="Listen to cloned voice"
                      >
                        {isSpeaking ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                        <span>Cloned Voice</span>
                      </button>
                      <button className="msg-action-btn">
                        <Sparkles size={14} />
                        <span>Explain Better</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="msg-meta">
                  {msg.role === "ai" ? activeTeacher?.name : "You"} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="chat-input-area">
        <div className="input-box-wrapper">
          <textarea 
            placeholder={activeTeacher ? `Message ${activeTeacher.name}...` : "Select a teacher..."} 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!activeTeacher}
            rows={1}
          />
          <button 
            className="chat-send-btn" 
            onClick={handleSend} 
            disabled={isStreaming || !inputText.trim() || !activeTeacher}
          >
            {isStreaming ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
});

export default StudentChat;
