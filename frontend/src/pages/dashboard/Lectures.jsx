import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  Trash2, 
  Calendar, 
  Layers, 
  Loader2, 
  AlertCircle, 
  BookOpen,
  Atom,
  Binary,
  Code,
  Beaker,
  Brain
} from 'lucide-react';
import { motion } from 'framer-motion';
import { apiRequest } from '../../api/api';

// Mapping string icons to Lucide components
const IconMap = {
  'Atom': Atom,
  'Binary': Binary,
  'Code': Code,
  'Beaker': Beaker,
  'Brain': Brain
};

export default function Lectures() {
  const [documents, setDocuments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("");
  
  // Deletion confirmation state
  const [deletingFileId, setDeletingFileId] = useState(null);
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploadSubjectId, setUploadSubjectId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch subjects and documents in parallel
      const [docsData, subjectsData] = await Promise.all([
        apiRequest("/ingest"),
        apiRequest("/dashboard/subjects")
      ]);
      setDocuments(docsData);
      setSubjects(subjectsData);
    } catch (err) {
      console.error("Failed to load lectures data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const docsData = await apiRequest("/ingest");
      setDocuments(docsData);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  };

  const handleDeleteConfirm = async (fileId) => {
    setLoading(true);
    try {
      await apiRequest(`/ingest/document/${fileId}`, {
        method: "DELETE"
      });
      await fetchDocuments();
      setDeletingFileId(null);
    } catch (err) {
      console.error("Failed to delete document:", err);
      alert(err.message || "Failed to delete document.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!fileToUpload || !uploadSubjectId) return;

    setUploading(true);
    setUploadError("");
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append("file", fileToUpload);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/ingest/file?subject_id=${uploadSubjectId}`, 
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Ingestion failed");
      }

      setUploadSuccess(true);
      setFileToUpload(null);
      
      // Refresh documents
      await fetchDocuments();
      
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess(false);
        setUploadSubjectId("");
      }, 1200);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  const getSubjectName = (subjectId) => {
    const sub = subjects.find(s => s.id === subjectId);
    return sub ? sub.name : (subjectId || "Unassigned");
  };

  const getSubjectIcon = (subjectId) => {
    const sub = subjects.find(s => s.id === subjectId);
    return sub ? sub.icon : "BookOpen";
  };

  // Filter documents based on search and subject selector
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubjectFilter === "" || doc.subject_id === selectedSubjectFilter;
    return matchesSearch && matchesSubject;
  });

  if (loading && documents.length === 0) {
    return (
      <div className="loading-state">
        <Loader2 className="animate-spin" /> 
        Loading Study Materials...
      </div>
    );
  }

  return (
    <div className="lectures-page fade-in">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="header-text">
          <h2>Study Resources</h2>
          <p>Manage learning materials, PDFs, and notes ingested for AI Teacher grounding</p>
        </div>
        <button 
          className="btn-primary" 
          onClick={() => setShowUploadModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}
        >
          <Plus size={16} />
          <span>Upload Material</span>
        </button>
      </header>

      {/* Search and Filters Bar */}
      <div className="archive-controls" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-lg)',
        flexWrap: 'wrap'
      }}>
        <div className="search-box" style={{ flex: 1, minWidth: '280px' }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search resources by filename..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <select 
          value={selectedSubjectFilter}
          onChange={(e) => setSelectedSubjectFilter(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid var(--color-rule)',
            backgroundColor: 'var(--color-paper-3)',
            color: 'var(--color-ink)',
            outline: 'none',
            cursor: 'pointer',
            height: '42px',
            fontWeight: '600',
            fontSize: '0.875rem'
          }}
        >
          <option value="">All Subjects</option>
          {subjects.map(sub => (
            <option key={sub.id} value={sub.id}>{sub.name}</option>
          ))}
        </select>
      </div>

      <div className="lectures-grid">
        {filteredDocs.length > 0 ? (
          filteredDocs.map((doc, i) => {
            const SubjectIcon = IconMap[getSubjectIcon(doc.subject_id)] || BookOpen;
            return (
              <motion.div 
                key={doc.file_id || i} 
                className="lecture-card"
                whileHover={{ y: -5 }}
                transition={{ duration: 0.2 }}
              >
                {/* Visual Thumbnail header block */}
                <div className="video-thumbnail" style={{
                  background: 'linear-gradient(135deg, var(--color-paper-3) 0%, var(--color-paper-1) 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 'var(--space-md)',
                  height: '140px',
                  position: 'relative',
                  borderBottom: '1px solid var(--color-rule)'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    padding: '4px 8px',
                    background: 'var(--color-accent-glow)',
                    color: 'var(--color-accent)',
                    borderRadius: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <SubjectIcon size={12} />
                    <span>{getSubjectName(doc.subject_id)}</span>
                  </div>
                  
                  <FileText size={44} style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-xs)' }} />
                  
                  <span className="duration" style={{ fontSize: '0.75rem', color: 'var(--color-subtle)' }}>
                    <Layers size={11} style={{ display: 'inline', marginRight: '4px' }} />
                    {doc.chunk_count} Chunks
                  </span>
                </div>

                {/* Info and Actions */}
                <div className="lecture-info">
                  <div className="title-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                    <h3 style={{ width: '100%', wordBreak: 'break-all' }} title={doc.filename}>{doc.filename}</h3>
                  </div>
                  
                  <div className="meta-row" style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-rule)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-subtle)' }}>
                      <Calendar size={12} style={{ marginRight: '4px' }} />
                      {new Date(doc.timestamp).toLocaleDateString()}
                    </span>
                    
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
                      <span className="status-badge ready">Ready</span>
                      <button 
                        className="icon-btn" 
                        onClick={() => setDeletingFileId(doc.file_id)}
                        style={{
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          border: '1px solid var(--color-rule)',
                          background: 'var(--color-paper-3)',
                          color: 'var(--color-danger)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                        title="Delete resource"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="no-data-msg">
            <p>No processed study resources found matching your search. Click "Upload Material" to add some!</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingFileId && (
        <div className="teacher-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="teacher-selection-box" style={{ maxWidth: '400px', padding: 'var(--space-xl)', textAlign: 'center' }}>
            <AlertCircle size={44} style={{ color: 'var(--color-danger)', margin: '0 auto var(--space-md) auto' }} />
            <h2 style={{ fontSize: '1.25rem' }}>Delete <span>Study Resource</span></h2>
            <p style={{ margin: 'var(--space-sm) 0 var(--space-lg) 0', fontSize: '0.875rem', color: 'var(--color-muted)', lineHeight: '1.5' }}>
              Are you sure you want to delete this resource? This will remove the document, its extracted text, and its vector embeddings. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
              <button 
                className="close-btn" 
                onClick={() => setDeletingFileId(null)}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="learn-now-btn" 
                onClick={() => handleDeleteConfirm(deletingFileId)}
                style={{ background: 'var(--color-danger)', border: 'none' }}
                disabled={loading}
              >
                {loading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local Ingestion Upload Modal Overlay */}
      {showUploadModal && (
        <div className="teacher-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="teacher-selection-box" style={{ maxWidth: '480px', padding: 'var(--space-xl)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-xs)' }}>Upload <span>Study Resource</span></h2>
            <p style={{ fontSize: '0.875rem', marginBottom: 'var(--space-lg)', color: 'var(--color-muted)' }}>Select a PDF, PPTX, or TXT document to ingest into ChromaDB.</p>
            
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div 
                style={{
                  border: '2px dashed var(--color-rule)',
                  borderRadius: '8px',
                  padding: 'var(--space-xl)',
                  cursor: 'pointer',
                  backgroundColor: 'var(--color-paper-3)',
                  transition: 'border-color var(--transition-fast)',
                  textAlign: 'center'
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setFileToUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => document.getElementById('local-modal-file-input').click()}
              >
                <input 
                  id="local-modal-file-input"
                  type="file" 
                  accept=".pdf,.pptx,.ppt,.txt,.md"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFileToUpload(e.target.files[0]);
                    }
                  }}
                  style={{ display: 'none' }}
                />
                <FileText size={32} style={{ margin: '0 auto var(--space-xs) auto', color: 'var(--color-muted)' }} />
                <span style={{ fontSize: '0.875rem', display: 'block', fontWeight: 600 }}>
                  {fileToUpload ? fileToUpload.name : "Drag & Drop or Click to browse"}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-subtle)', marginTop: '4px', display: 'block' }}>
                  Supports PDF, PPTX, TXT or Markdown
                </span>
              </div>

              <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-muted)' }}>Associate with Subject</label>
                <select 
                  value={uploadSubjectId}
                  onChange={(e) => setUploadSubjectId(e.target.value)}
                  required
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-rule)',
                    backgroundColor: 'var(--color-paper-3)',
                    color: 'var(--color-ink)',
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  <option value="" disabled>Select a subject</option>
                  {subjects.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              {uploadError && (
                <div style={{ color: 'var(--color-danger)', fontSize: '0.8125rem', textAlign: 'left' }}>
                  ⚠️ {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div style={{ color: 'var(--color-success)', fontSize: '0.8125rem', fontWeight: 700 }}>
                  ✓ Resource uploaded and ingested successfully!
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end', marginTop: 'var(--space-sm)' }}>
                <button 
                  type="button" 
                  className="close-btn"
                  onClick={() => {
                    setShowUploadModal(false);
                    setFileToUpload(null);
                    setUploadError("");
                  }}
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="learn-now-btn"
                  disabled={!fileToUpload || !uploadSubjectId || uploading || uploadSuccess}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Ingesting...</span>
                    </>
                  ) : (
                    <span>Upload & Ingest</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
