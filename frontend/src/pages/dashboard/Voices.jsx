import React, { useState, useEffect, useRef } from "react";
import { apiRequest } from "../../api/api";
import { 
  Volume2, 
  VolumeX, 
  PlusCircle, 
  Loader2, 
  FileAudio, 
  ShieldCheck, 
  AlertTriangle 
} from "lucide-react";
import { motion } from "framer-motion";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function Voices() {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Upload form state
  const [voiceId, setVoiceId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Playback state
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    fetchVoices();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const fetchVoices = async () => {
    try {
      const data = await apiRequest("/tts/voices");
      setVoices(data);
    } catch (err) {
      console.error("Failed to fetch voices:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !voiceId.trim()) return;

    setUploading(true);
    setUploadError("");
    setUploadSuccess(false);

    const cleanVoiceId = voiceId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/tts/upload?voice_id=${cleanVoiceId}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Upload failed");
      }

      setUploadSuccess(true);
      setVoiceId("");
      setSelectedFile(null);
      
      // Refresh list
      fetchVoices();
    } catch (err) {
      console.error("Voice upload error:", err);
      setUploadError(err.message || "Failed to upload voice file.");
    } finally {
      setUploading(false);
    }
  };

  const playVoice = (vid) => {
    if (playingVoiceId === vid && audioRef.current) {
      audioRef.current.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setPlayingVoiceId(vid);
    const audioUrl = `${API_BASE_URL}/tts/voices/${vid}`;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => {
      console.error("Playback failed for voice:", vid);
      setPlayingVoiceId(null);
    };
    audio.play().catch(err => {
      console.error("Audio play failed:", err);
      setPlayingVoiceId(null);
    });
  };

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="animate-spin" />
        <span>Loading voice inventory...</span>
      </div>
    );
  }

  return (
    <div className="voices-page fade-in" style={{ padding: "var(--space-md) 0", maxWidth: "1200px", margin: "0 auto" }}>
      <header className="page-header" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="header-text">
          <h2 style={{ fontSize: "1.875rem", fontWeight: 800 }}>Voice Reference <span>Manager</span></h2>
          <p style={{ color: "var(--color-muted)", fontSize: "0.9375rem" }}>Upload 10-second reference audio voice samples to clone and verify student or teacher voices.</p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "var(--space-lg)" }}>
        {/* Upload Column */}
        <motion.div 
          className="subject-card"
          style={{ cursor: "default", height: "fit-content", padding: "var(--space-xl)" }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="subject-icon-wrapper" style={{ backgroundColor: "var(--color-accent-glow)" }}>
            <PlusCircle size={24} className="text-purple-400" />
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "var(--space-sm) 0" }}>Register Voice Clones</h3>
          <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginBottom: "var(--space-lg)" }}>Provide a descriptive unique ID and upload a high-quality WAV/AAC sample.</p>

          <form onSubmit={handleUploadSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)" }}>Unique Voice ID</label>
              <input 
                type="text" 
                placeholder="e.g. prof-sharma or student-vaibhav"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                disabled={uploading}
                required
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-rule)",
                  backgroundColor: "var(--color-paper-3)",
                  color: "var(--color-ink)",
                  outline: "none"
                }}
              />
            </div>

            <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)" }}>Audio File (.wav, .mp3, .aac)</label>
              <div 
                style={{
                  border: "2px dashed var(--color-rule)",
                  borderRadius: "8px",
                  padding: "var(--space-lg)",
                  cursor: "pointer",
                  backgroundColor: "var(--color-paper-3)",
                  textAlign: "center",
                  transition: "border-color var(--transition-fast)"
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setSelectedFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => document.getElementById("voice-file-input").click()}
              >
                <input 
                  id="voice-file-input"
                  type="file" 
                  accept=".wav,.mp3,.aac,.flac"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  style={{ display: "none" }}
                />
                <FileAudio size={28} style={{ margin: "0 auto var(--space-xs) auto", color: "var(--color-muted)" }} />
                <span style={{ fontSize: "0.875rem", display: "block", fontWeight: 600 }}>
                  {selectedFile ? selectedFile.name : "Drag & Drop or Click to browse"}
                </span>
              </div>
            </div>

            {uploadError && (
              <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem", display: "flex", gap: "4px", alignItems: "center" }}>
                <AlertTriangle size={14} />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div style={{ color: "var(--color-success)", fontSize: "0.8125rem", fontWeight: 700 }}>
                ✓ Voice clone registered successfully!
              </div>
            )}

            <button 
              type="submit" 
              className="learn-now-btn" 
              disabled={!selectedFile || !voiceId.trim() || uploading}
              style={{ width: "100%", justifyContent: "center", padding: "12px", gap: "var(--space-xs)", display: "flex", alignItems: "center" }}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Uploading & Registering...</span>
                </>
              ) : (
                <span>Register Voice Reference</span>
              )}
            </button>
          </form>
        </motion.div>

        {/* List Column */}
        <motion.div 
          className="subject-card"
          style={{ cursor: "default", height: "fit-content", padding: "var(--space-xl)" }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="subject-icon-wrapper" style={{ backgroundColor: "var(--color-success-bg)" }}>
            <ShieldCheck size={24} className="text-green-400" />
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "var(--space-sm) 0" }}>Stored Speaker Profiles</h3>
          <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginBottom: "var(--space-lg)" }}>List of active custom voice reference signatures loaded in the system.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {voices.length > 0 ? (
              voices.map((vid) => (
                <div 
                  key={vid}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    backgroundColor: "var(--color-paper-3)",
                    border: "1px solid var(--color-rule)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <FileAudio size={18} className="text-purple-400" />
                    <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{vid}</span>
                  </div>
                  <button
                    onClick={() => playVoice(vid)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: playingVoiceId === vid ? "var(--color-success)" : "var(--color-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "6px",
                      borderRadius: "50%",
                      backgroundColor: playingVoiceId === vid ? "var(--color-success-bg)" : "transparent",
                      transition: "all var(--transition-fast)"
                    }}
                  >
                    {playingVoiceId === vid ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                </div>
              ))
            ) : (
              <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", fontStyle: "italic" }}>
                No custom voices found. Upload a file above to begin cloning!
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
