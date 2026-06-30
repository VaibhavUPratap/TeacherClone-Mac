import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Video,
  FileText,
  BarChart3,
  Archive,
  Settings,
  HelpCircle,
  PlusCircle,
  Library,
  LogOut,
  User,
  Bell,
  Search,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

/* ──────────────────────────────────────────
   Sidebar item — N9 edge-aligned minimal
   Warm amber active pill + bloom bg
────────────────────────────────────────── */
const SidebarItem = ({ icon: Icon, label, path, active }) => (
  <Link to={path} tabIndex={0} aria-current={active ? 'page' : undefined}>
    <motion.div
      className={`sidebar-item ${active ? 'active' : ''}`}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
      <span>{label}</span>
      {active && (
        <motion.div
          layoutId="active-pill"
          className="active-pill"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
    </motion.div>
  </Link>
);

export default function DashboardLayout() {
  const location  = useLocation();
  const current   = location.pathname;
  const { user, role, supabase } = useAuth();
  const navigate  = useNavigate();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [subjectsList, setSubjectsList] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Fetch subjects dynamically when the modal opens
  React.useEffect(() => {
    if (showUploadModal) {
      fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/dashboard/subjects`)
        .then(res => res.json())
        .then(data => {
          setSubjectsList(data);
          if (data.length > 0) {
            setSelectedSubjectId(data[0].id);
          }
        })
        .catch(err => console.error("Error fetching subjects in layout:", err));
    }
  }, [showUploadModal]);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!fileToUpload) return;

    setUploading(true);
    setUploadError("");
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append("file", fileToUpload);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/ingest/file?subject_id=${selectedSubjectId}`, 
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
      
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess(false);
        if (location.pathname === '/dashboard/lectures' || location.pathname === '/dashboard') {
          window.location.reload();
        }
      }, 1500);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  const displayName = user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'User';

  return (
    <div className="dashboard-container">
      {/* ── Sidebar ── */}
      <aside className="dashboard-sidebar">
        {/* Wordmark */}
        <div className="sidebar-header" style={{ position: 'relative' }}>
          <div className="logo-glow" />
          <h1 className="logo-text">
            TEACHER<span>CLONE</span>
          </h1>
        </div>

        {/* New Resource CTA — teacher only */}
        {role === 'teacher' && (
          <button 
            className="new-session-btn" 
            id="new-resource-btn"
            onClick={() => setShowUploadModal(true)}
          >
            <PlusCircle size={16} strokeWidth={2.2} />
            <span>New Resource</span>
          </button>
        )}

        {/* Primary nav */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          <p className="nav-label">
            {role === 'teacher' ? 'Faculty' : role === 'admin' ? 'Administrator' : 'Student'}
          </p>

          {role === 'admin' ? (
            <>
              <SidebarItem icon={LayoutDashboard} label="Dashboard"       path="/dashboard"              active={current === '/dashboard'} />
              <SidebarItem icon={PlusCircle}       label="Manage Voices"    path="/dashboard/voices"       active={current === '/dashboard/voices'} />
              <SidebarItem icon={Sparkles}         label="Clone Studio"     path="/dashboard/clone-studio" active={current === '/dashboard/clone-studio'} />
              <SidebarItem icon={Video}            label="Lectures"         path="/dashboard/lectures"     active={current === '/dashboard/lectures'} />
            </>
          ) : role === 'teacher' ? (
            <>
              <SidebarItem icon={LayoutDashboard} label="Class Materials" path="/dashboard"              active={current === '/dashboard'} />
              <SidebarItem icon={BarChart3}       label="Analytics"        path="/dashboard/data"         active={current === '/dashboard/data'} />
              <SidebarItem icon={FileText}         label="Slides"           path="/dashboard/slides"       active={current === '/dashboard/slides'} />
              <SidebarItem icon={Video}            label="Lectures"         path="/dashboard/lectures"     active={current === '/dashboard/lectures'} />
              <SidebarItem icon={MessageSquare}    label="Student Chats"    path="/dashboard/conversations" active={current === '/dashboard/conversations'} />
              <SidebarItem icon={Archive}          label="Archive"          path="/dashboard/archive"      active={current === '/dashboard/archive'} />
            </>
          ) : (
            <>
              <SidebarItem icon={LayoutDashboard} label="Home"          path="/dashboard"               active={current === '/dashboard'} />
              <SidebarItem icon={Library}          label="Subjects"      path="/dashboard/subjects"      active={current === '/dashboard/subjects'} />
              <SidebarItem icon={MessageSquare}    label="Ask Teacher"   path="/dashboard/interaction"  active={current === '/dashboard/interaction'} />
              <SidebarItem icon={BarChart3}        label="My Progress"   path="/dashboard/analytics"    active={current === '/dashboard/analytics'} />
              <SidebarItem icon={Archive}          label="History"       path="/dashboard/conversations" active={current === '/dashboard/conversations'} />
            </>
          )}
        </nav>

        {/* Footer: support + settings + user profile */}
        <div className="sidebar-footer">
          <nav className="sidebar-nav" aria-label="Secondary navigation">
            <SidebarItem icon={HelpCircle} label="Support"  path="/support"  active={current === '/support'} />
            <SidebarItem icon={Settings}   label="Settings" path="/settings" active={current === '/settings'} />
          </nav>

          <div className="user-profile">
            <div className="user-avatar">
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={displayName}
                  style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                />
              ) : (
                <User size={16} strokeWidth={1.8} />
              )}
            </div>
            <div className="user-info">
              <p className="user-name">{displayName}</p>
              <p className="user-role">{role || 'Academic'}</p>
            </div>
            <button
              className="logout-btn"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content stage ── */}
      <main className="dashboard-main">
        {/* Top header bar */}
        <header className="dashboard-header">
          <div className="header-search">
            <input
              id="global-search"
              type="search"
              placeholder="Search resources, conversations…"
              aria-label="Search"
            />
          </div>

          <div className="header-actions">
            <div className="status-indicator" aria-label="System status: online">
              <div className="status-dot online" />
              <span>Online</span>
            </div>
            <button className="notification-btn" aria-label="Notifications" id="notifications-btn">
              <Bell size={16} strokeWidth={1.8} />
              <span className="notification-badge" />
            </button>
          </div>
        </header>

        {/* Page outlet */}
        <div className="content-area">
          <Outlet />
        </div>
      </main>

      {/* Ingestion Upload Modal Overlay */}
      {showUploadModal && (
        <div className="teacher-modal-overlay">
          <div className="teacher-selection-box" style={{ maxWidth: '480px', padding: 'var(--space-xl)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-xs)' }}>Upload <span>Study Resource</span></h2>
            <p style={{ fontSize: '0.875rem', marginBottom: 'var(--space-lg)' }}>Select a PDF, PPTX, or TXT document to ingest into ChromaDB.</p>
            
            <form onSubmit={handleFileUpload} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
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
                onClick={() => document.getElementById('modal-file-input').click()}
              >
                <input 
                  id="modal-file-input"
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
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  required
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-rule)',
                    backgroundColor: 'var(--color-paper-3)',
                    color: 'var(--color-ink)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {subjectsList.map(sub => (
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
                  disabled={!fileToUpload || uploading || uploadSuccess}
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
