import React, { useState, useEffect, useRef } from "react";
import { 
  Video, 
  Users, 
  PlusCircle, 
  Loader2, 
  Sparkles, 
  BookOpen, 
  Trash2, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw, 
  Volume2, 
  VolumeX,
  FileVideo,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "../../api/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function CloneStudio() {
  const [subjects, setSubjects] = useState([]);
  const [clones, setClones] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  // Form input states
  const [teacherName, setTeacherName] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [teachingStyle, setTeachingStyle] = useState("");
  const [description, setDescription] = useState("");
  const [avatarSeed, setAvatarSeed] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  
  // Pipeline/Job States
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [pipelineError, setPipelineError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // Preview / Finalization State
  const [showPreview, setShowPreview] = useState(false);
  const [editablePrompt, setEditablePrompt] = useState("");
  const [previewVoiceId, setPreviewVoiceId] = useState("");
  const [previewTeacherId, setPreviewTeacherId] = useState("");
  const [playingPreview, setPlayingPreview] = useState(false);
  const audioRef = useRef(null);

  // Poll timer reference
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
    return () => {
      stopPolling();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      // Fetch subjects for select dropdown
      const subjectsData = await apiRequest("/dashboard/subjects");
      setSubjects(subjectsData);
      if (subjectsData.length > 0) {
        setSelectedSubjectId(subjectsData[0].id);
      }

      // Fetch existing clones
      await fetchClones();
    } catch (err) {
      console.error("Error fetching initial studio data:", err);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchClones = async () => {
    try {
      const data = await apiRequest("/clone/list");
      setClones(data);
    } catch (err) {
      console.error("Failed to list clones:", err);
    }
  };

  const handleStartCloning = async (e) => {
    e.preventDefault();
    if (!videoFile || !teacherName.trim()) return;

    setSubmitting(true);
    setPipelineError("");
    setShowPreview(false);
    setJobStatus(null);

    const formData = new FormData();
    formData.append("teacher_name", teacherName.trim());
    formData.append("subject_id", selectedSubjectId);
    formData.append("teaching_style", teachingStyle.trim());
    formData.append("description", description.trim());
    formData.append("avatar_seed", avatarSeed.trim());
    formData.append("file", videoFile);

    try {
      const response = await fetch(`${API_BASE_URL}/clone/create`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to start cloning pipeline");
      }

      const data = await response.json();
      setActiveJobId(data.job_id);
      startPolling(data.job_id);
    } catch (err) {
      console.error("Clone creation failed:", err);
      setPipelineError(err.message || "An error occurred starting the pipeline.");
      setSubmitting(false);
    }
  };

  const startPolling = (jobId) => {
    stopPolling();
    // Poll immediately, then every 3 seconds
    pollJobStatus(jobId);
    pollIntervalRef.current = setInterval(() => {
      pollJobStatus(jobId);
    }, 3000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const pollJobStatus = async (jobId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/clone/status/${jobId}`);
      if (!response.ok) {
        throw new Error("Job status check failed");
      }
      const statusData = await response.json();
      setJobStatus(statusData);

      if (statusData.status === "completed") {
        stopPolling();
        setSubmitting(false);
        setPreviewVoiceId(statusData.voice_id);
        setPreviewTeacherId(statusData.teacher_id);
        setEditablePrompt(statusData.personality_prompt || "");
        setShowPreview(true);
      } else if (statusData.status === "failed") {
        stopPolling();
        setSubmitting(false);
        setPipelineError(statusData.message || "Pipeline failed unexpectedly.");
      }
    } catch (err) {
      console.error("Error polling job status:", err);
    }
  };

  const handleFinalizeClone = async () => {
    setFinalizing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/clone/${previewTeacherId}/finalize`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personality_prompt: editablePrompt }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Finalization failed");
      }

      // Success - reset all creation states
      setActiveJobId(null);
      setJobStatus(null);
      setShowPreview(false);
      setTeacherName("");
      setTeachingStyle("");
      setDescription("");
      setAvatarSeed("");
      setVideoFile(null);
      
      // Refresh list
      await fetchClones();
    } catch (err) {
      console.error("Error finalizing clone:", err);
      alert(err.message || "Failed to save finalized clone details.");
    } finally {
      setFinalizing(false);
    }
  };

  const handleDeleteClone = async (teacherId) => {
    if (!window.confirm("Are you sure you want to delete this teacher clone? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/clone/${teacherId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Delete failed");
      }

      // Refresh list
      await fetchClones();
    } catch (err) {
      console.error("Error deleting clone:", err);
      alert(err.message || "Failed to delete clone.");
    }
  };

  const playPreviewAudio = () => {
    if (playingPreview && audioRef.current) {
      audioRef.current.pause();
      setPlayingPreview(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setPlayingPreview(true);
    const audioUrl = `${API_BASE_URL}/tts/voices/${previewVoiceId}`;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => setPlayingPreview(false);
    audio.onerror = () => {
      console.error("Preview playback failed");
      setPlayingPreview(false);
    };
    audio.play().catch(err => {
      console.error("Audio preview failed:", err);
      setPlayingPreview(false);
    });
  };

  const cancelJob = () => {
    stopPolling();
    setActiveJobId(null);
    setJobStatus(null);
    setSubmitting(false);
    setPipelineError("");
  };

  const getSubjectName = (subId) => {
    const sub = subjects.find(s => s.id === subId);
    return sub ? sub.name : subId;
  };

  // Render checkmarks for active pipeline status
  const renderStageIndicator = (stageProgress, label, currentProgress) => {
    const completed = currentProgress >= stageProgress;
    const isCurrent = currentProgress > 0 && currentProgress < 100 && 
                      ((stageProgress === 10 && currentProgress < 25) ||
                       (stageProgress === 25 && currentProgress >= 25 && currentProgress < 50) ||
                       (stageProgress === 50 && currentProgress >= 50 && currentProgress < 75) ||
                       (stageProgress === 75 && currentProgress >= 75 && currentProgress < 90) ||
                       (stageProgress === 90 && currentProgress >= 90 && currentProgress < 100));

    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", padding: "12px 16px", borderRadius: "8px", backgroundColor: isCurrent ? "var(--color-accent-glow)" : completed ? "var(--color-success-bg)" : "var(--color-paper-3)", border: "1px solid var(--color-rule)", transition: "all var(--transition-fast)" }}>
        {completed ? (
          <CheckCircle2 className="text-green-400" size={20} />
        ) : isCurrent ? (
          <Loader2 className="animate-spin text-purple-400" size={20} />
        ) : (
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: "2px solid var(--color-muted)" }} />
        )}
        <span style={{ fontSize: "0.9375rem", fontWeight: isCurrent || completed ? 600 : 400, color: completed ? "var(--color-ink)" : isCurrent ? "var(--color-accent)" : "var(--color-muted)" }}>
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="clone-studio fade-in" style={{ padding: "var(--space-md) 0", maxWidth: "1200px", margin: "0 auto" }}>
      <header className="page-header" style={{ marginBottom: "var(--space-xl)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="header-text">
          <h2 style={{ fontSize: "1.875rem", fontWeight: 800 }}>Teacher Clone <span>Studio</span></h2>
          <p style={{ color: "var(--color-muted)", fontSize: "0.9375rem" }}>
            Generate fully interactive AI teacher avatars with dynamic voices and personalities directly from lecture videos.
          </p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "var(--space-xl)", alignItems: "start" }}>
        
        {/* Creation Workflow Column */}
        <div>
          <AnimatePresence mode="wait">
            {!submitting && !showPreview && (
              <motion.div
                key="studio-form"
                className="subject-card"
                style={{ cursor: "default", padding: "var(--space-xl)" }}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <div className="subject-icon-wrapper" style={{ backgroundColor: "var(--color-accent-glow)" }}>
                  <Sparkles size={24} className="text-purple-400" />
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "var(--space-sm) 0" }}>Create New Clone</h3>
                <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginBottom: "var(--space-lg)" }}>
                  Provide class meta and upload a lecture video to start the automated cloning process.
                </p>

                <form onSubmit={handleStartCloning} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                    <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)" }}>Teacher Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Andrew Ng"
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
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
                      <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)" }}>Subject</label>
                      <select 
                        value={selectedSubjectId}
                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                        required
                        style={{
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: "1px solid var(--color-rule)",
                          backgroundColor: "var(--color-paper-3)",
                          color: "var(--color-ink)",
                          outline: "none",
                          cursor: "pointer"
                        }}
                      >
                        {subjects.map(sub => (
                          <option key={sub.id} value={sub.id}>{sub.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                    <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)" }}>Teaching Style (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Socratic, Practical, Intuitive"
                        value={teachingStyle}
                        onChange={(e) => setTeachingStyle(e.target.value)}
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
                      <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)" }}>Avatar Seed / Theme (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. andrew-ml, fresh, smart"
                        value={avatarSeed}
                        onChange={(e) => setAvatarSeed(e.target.value)}
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
                  </div>

                  <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)" }}>Short Bio / Description</label>
                    <textarea 
                      placeholder="Give a short bio of the teacher's background and target students..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--color-rule)",
                        backgroundColor: "var(--color-paper-3)",
                        color: "var(--color-ink)",
                        outline: "none",
                        resize: "vertical"
                      }}
                    />
                  </div>

                  <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-muted)" }}>Lecture Video File</label>
                    <div 
                      style={{
                        border: "2px dashed var(--color-rule)",
                        borderRadius: "8px",
                        padding: "var(--space-xl)",
                        cursor: "pointer",
                        backgroundColor: "var(--color-paper-3)",
                        textAlign: "center",
                        transition: "border-color var(--transition-fast)"
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          setVideoFile(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => document.getElementById("lecture-video-input").click()}
                    >
                      <input 
                        id="lecture-video-input"
                        type="file" 
                        accept="video/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setVideoFile(e.target.files[0]);
                          }
                        }}
                        style={{ display: "none" }}
                      />
                      <FileVideo size={36} style={{ margin: "0 auto var(--space-xs) auto", color: "var(--color-muted)" }} />
                      <span style={{ fontSize: "0.9375rem", display: "block", fontWeight: 600 }}>
                        {videoFile ? videoFile.name : "Drag & Drop Lecture Video or Click to browse"}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-subtle)", marginTop: "4px", display: "block" }}>
                        Supports MP4, WebM, MKV (at least 20-30 seconds of spoken voice recommended)
                      </span>
                    </div>
                  </div>

                  {pipelineError && (
                    <div style={{ color: "var(--color-danger)", fontSize: "0.875rem", display: "flex", gap: "6px", alignItems: "center", padding: "10px 14px", backgroundColor: "var(--color-danger-bg)", borderRadius: "8px", border: "1px solid var(--color-rule)" }}>
                      <AlertCircle size={16} />
                      <span>{pipelineError}</span>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="learn-now-btn" 
                    disabled={!videoFile || !teacherName.trim() || submitting}
                    style={{ width: "100%", justifyContent: "center", padding: "14px", gap: "var(--space-xs)", display: "flex", alignItems: "center", fontSize: "0.9375rem" }}
                  >
                    <span>Create AI Clone</span>
                  </button>
                </form>
              </motion.div>
            )}

            {submitting && jobStatus && (
              <motion.div
                key="studio-progress"
                className="subject-card"
                style={{ cursor: "default", padding: "var(--space-xl)" }}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Cloning Pipeline Active</h3>
                  <button 
                    onClick={cancelJob}
                    style={{ background: "transparent", border: "none", color: "var(--color-danger)", cursor: "pointer", fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <ArrowLeft size={14} /> Stop & Cancel
                  </button>
                </div>
                
                <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginBottom: "var(--space-lg)" }}>
                  Generating AI clone for <strong>{teacherName}</strong>. Do not close this page. This may take a few minutes depending on server resources.
                </p>

                {/* Main Progress Bar */}
                <div style={{ margin: "var(--space-md) 0 var(--space-xl) 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.875rem", fontWeight: 600 }}>
                    <span style={{ color: "var(--color-accent)" }}>{jobStatus.message || "Initializing..."}</span>
                    <span>{jobStatus.progress}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: "10px", backgroundColor: "var(--color-rule)" }}>
                    <motion.div 
                      className="fill" 
                      style={{ height: "100%", width: `${jobStatus.progress}%`, backgroundColor: "var(--color-accent)" }}
                      animate={{ width: `${jobStatus.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                {/* Pipeline Stage Steps */}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  {renderStageIndicator(10, "1. Save Lecture Video", jobStatus.progress)}
                  {renderStageIndicator(25, "2. Extract Speaker Voice Signature", jobStatus.progress)}
                  {renderStageIndicator(50, "3. Transcribe Audio (Whisper)", jobStatus.progress)}
                  {renderStageIndicator(75, "4. Analyze and Extract Persona (Ollama)", jobStatus.progress)}
                  {renderStageIndicator(90, "5. Synchronize Clone & Database", jobStatus.progress)}
                </div>
              </motion.div>
            )}

            {showPreview && (
              <motion.div
                key="studio-preview"
                className="subject-card"
                style={{ cursor: "default", padding: "var(--space-xl)" }}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <div className="subject-icon-wrapper" style={{ backgroundColor: "var(--color-success-bg)" }}>
                  <UserCheck size={24} className="text-green-400" />
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "var(--space-sm) 0" }}>Review & Finalize AI Clone</h3>
                <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginBottom: "var(--space-lg)" }}>
                  The cloning pipeline successfully parsed the voice and generated a personality profile. Review them below before deploying.
                </p>

                {/* Voice Preview Section */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", backgroundColor: "var(--color-paper-3)", borderRadius: "8px", border: "1px solid var(--color-rule)", marginBottom: "var(--space-md)" }}>
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Extracted Speaker Voice</h4>
                    <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>Verification WAV reference signature</p>
                  </div>
                  <button
                    onClick={playPreviewAudio}
                    className="learn-now-btn"
                    style={{
                      padding: "8px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.875rem"
                    }}
                  >
                    {playingPreview ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    <span>{playingPreview ? "Stop Preview" : "Play Voice"}</span>
                  </button>
                </div>
                {/* Extracted Teaching Features Section */}
                {jobStatus && jobStatus.features && (
                  <div style={{ marginBottom: "var(--space-md)" }}>
                    <h4 style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "var(--space-xs)" }}>Extracted Teaching Features</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                      <div style={{ padding: "12px", backgroundColor: "var(--color-paper-3)", borderRadius: "8px", border: "1px solid var(--color-rule)" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "block" }}>Vocabulary Level</span>
                        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--color-accent)" }}>
                          {jobStatus.features.vocabulary_level || "Intermediate"}
                        </span>
                      </div>
                      <div style={{ padding: "12px", backgroundColor: "var(--color-paper-3)", borderRadius: "8px", border: "1px solid var(--color-rule)" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "block" }}>Voice Playback Pacing</span>
                        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--color-accent)" }}>
                          {jobStatus.features.pacing_factor ? `${jobStatus.features.pacing_factor}x` : "1.00x"}
                        </span>
                      </div>
                      <div style={{ padding: "12px", backgroundColor: "var(--color-paper-3)", borderRadius: "8px", border: "1px solid var(--color-rule)" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "block" }}>Analogy Frequency</span>
                        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--color-accent)" }}>
                          {jobStatus.features.analogy_frequency || "Medium"}
                        </span>
                      </div>
                      <div style={{ padding: "12px", backgroundColor: "var(--color-paper-3)", borderRadius: "8px", border: "1px solid var(--color-rule)" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", display: "block" }}>Analogy Reference Style</span>
                        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--color-accent)" }}>
                          {jobStatus.features.analogy_style || "general examples"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Personality Textarea */}
                <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "var(--space-lg)" }}>
                  <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>Extracted System Prompt (AI Personality)</label>
                  <textarea 
                    value={editablePrompt}
                    onChange={(e) => setEditablePrompt(e.target.value)}
                    rows={8}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--color-rule)",
                      backgroundColor: "var(--color-paper-3)",
                      color: "var(--color-ink)",
                      fontFamily: "monospace",
                      fontSize: "0.8125rem",
                      outline: "none",
                      resize: "vertical"
                    }}
                  />
                  <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                    Feel free to modify the prompt to tune how the AI teacher responds to students.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "flex-end" }}>
                  <button 
                    onClick={() => {
                      setShowPreview(false);
                      setActiveJobId(null);
                      setJobStatus(null);
                    }}
                    style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid var(--color-rule)", backgroundColor: "transparent", color: "var(--color-ink)", cursor: "pointer" }}
                  >
                    Discard
                  </button>
                  <button 
                    onClick={handleFinalizeClone}
                    className="learn-now-btn"
                    disabled={finalizing || !editablePrompt.trim()}
                    style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", padding: "10px 20px" }}
                  >
                    {finalizing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Deploying Clone...</span>
                      </>
                    ) : (
                      <span>Save & Deploy Clone</span>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Existing Clones Inventory List Column */}
        <div className="subject-card" style={{ cursor: "default", padding: "var(--space-xl)", height: "fit-content" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <div className="subject-icon-wrapper" style={{ backgroundColor: "var(--color-success-bg)" }}>
                <Users size={20} className="text-green-400" />
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Deploying Clones Inventory</h3>
            </div>
            <button 
              onClick={fetchClones} 
              style={{ background: "transparent", border: "none", color: "var(--color-muted)", cursor: "pointer", display: "flex", alignItems: "center", padding: "6px", borderRadius: "50%" }}
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginBottom: "var(--space-lg)" }}>
            Review, audit, or delete active AI clones running in the system.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", maxHeight: "600px", overflowY: "auto" }}>
            {loadingList ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-xl) 0" }}>
                <Loader2 className="animate-spin text-purple-400" />
              </div>
            ) : clones.length > 0 ? (
              clones.map((clone) => (
                <div 
                  key={clone.id}
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    backgroundColor: "var(--color-paper-3)",
                    border: "1px solid var(--color-rule)",
                    position: "relative"
                  }}
                >
                  <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "flex-start" }}>
                    <img 
                      src={clone.avatar_url} 
                      alt={clone.name} 
                      style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--color-accent-glow)" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontWeight: 700, fontSize: "0.9375rem", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                        {clone.name}
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "2px 8px", borderRadius: "10px", backgroundColor: "var(--color-accent-glow)", color: "var(--color-accent)" }}>
                          {getSubjectName(clone.subject_id)}
                        </span>
                      </h4>
                      <p style={{ color: "var(--color-subtle)", fontSize: "0.75rem", margin: "2px 0 6px 0", fontStyle: "italic" }}>
                        Style: {clone.teaching_style || "Dynamic"}
                      </p>
                      <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                        {clone.description}
                      </p>
                    </div>

                    <button 
                      onClick={() => handleDeleteClone(clone.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--color-danger)",
                        cursor: "pointer",
                        padding: "6px",
                        borderRadius: "4px",
                        transition: "all var(--transition-fast)"
                      }}
                      title="Delete Clone"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", fontStyle: "italic", textAlign: "center", padding: "var(--space-lg) 0" }}>
                No active AI teacher clones exist yet. Build one!
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
