import { useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, ShieldCheck, GraduationCap, Users, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.22, ease: [0.45, 0, 0.55, 1] } },
};

function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const navigate                = useNavigate();
  const { setRole: setGlobalRole } = useAuth();

  const [role, setRole] = useState(null);   // 'teacher' | 'student' | 'admin'
  const [step, setStep] = useState(1);      // 1: role pick  2: sign-in/up form
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    setStep(2);
    setIsSignUp(false);
    setEmail('');
    setPassword('');
    setFullName('');
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { data: { role } },
      });
      if (error) throw error;
      // If the real Supabase returns a redirect URL, the browser navigates automatically.
      // In mock mode (url: null) the listener fires immediately and AuthContext updates,
      // so navigate() here handles that case.
      if (!data?.url) {
        localStorage.setItem('userRole', role);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        if (!fullName.trim()) throw new Error("Full name is required for registration.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: role
            }
          }
        });
        if (error) throw error;
        
        localStorage.setItem("userRole", role);
        setGlobalRole(role);
        navigate("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Query database profiles table to get verified user role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        
        const verifiedRole = profile?.role || role || "student";
        
        localStorage.setItem("userRole", verifiedRole);
        setGlobalRole(verifiedRole);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <AnimatePresence mode="wait">
        {step === 1 ? (
          /* ── Step 1: Role pick ── */
          <motion.main
            key="role-step"
            className="login-card role-selection-card"
            {...fadeSlide}
          >
            <div className="login-header">
              <div className="login-wordmark">
                <span>TEACHERCLONE · ACADEMIC</span>
              </div>
              <h1>Who are <span>you?</span></h1>
              <p>Choose your path to enter the system.</p>
            </div>

            <div className="role-options">
              <motion.div
                className="role-card"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleRoleSelect("teacher")}
                role="button"
                tabIndex={0}
                id="role-teacher"
                onKeyDown={e => e.key === "Enter" && handleRoleSelect("teacher")}
              >
                <div className="role-icon-wrapper teacher">
                  <Users size={26} strokeWidth={1.8} />
                </div>
                <h3>Teacher</h3>
                <p>Manage classes, resources, and conversations.</p>
              </motion.div>

              <motion.div
                className="role-card"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleRoleSelect("student")}
                role="button"
                tabIndex={0}
                id="role-student"
                onKeyDown={e => e.key === "Enter" && handleRoleSelect("student")}
              >
                <div className="role-icon-wrapper student">
                  <GraduationCap size={26} strokeWidth={1.8} />
                </div>
                <h3>Student</h3>
                <p>Learn, ask questions, track your progress.</p>
              </motion.div>

              <motion.div
                className="role-card"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleRoleSelect("admin")}
                role="button"
                tabIndex={0}
                id="role-admin"
                onKeyDown={e => e.key === "Enter" && handleRoleSelect("admin")}
              >
                <div className="role-icon-wrapper admin">
                  <ShieldCheck size={26} strokeWidth={1.8} />
                </div>
                <h3>Admin</h3>
                <p>Upload teacher voices, lectures and information.</p>
              </motion.div>
            </div>
          </motion.main>
        ) : (
          /* ── Step 2: Sign-in form ── */
          <motion.main
            key="login-step"
            className="login-card"
            {...fadeSlide}
          >
            <button
              className="back-link"
              onClick={() => { setStep(1); setError(""); }}
              aria-label="Back to role selection"
            >
              ← Back
            </button>

             <div className="login-header">
              <div className="role-indicator">
                {role === "teacher" ? "Faculty" : role === "admin" ? "Admin" : "Student"} · {isSignUp ? "Sign up" : "Sign in"}
              </div>
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.35 }}
              >
                TEACHER<span>CLONE</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.22, duration: 0.35 }}
              >
                {isSignUp ? "Register your profile to get started." : `Your AI-powered ${role === "teacher" ? "faculty" : role === "admin" ? "admin" : "learning"} environment.`}
              </motion.p>
            </div>

            <form className="login-form" onSubmit={handleAuth} noValidate>
              {/* Quick credential filler helper - sign-in only */}
              {!isSignUp && (
                <div style={{
                  marginBottom: 'var(--space-md)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px dashed var(--color-rule)',
                  backgroundColor: 'var(--color-paper-3)',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-muted)' }}>Quick test login:</span>
                    <code style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>
                      {role === 'admin' ? 'admin@teacherclone.edu' : role === 'teacher' ? 'dr.rao@teacherclone.edu' : 'student@teacherclone.edu'}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (role === 'admin') {
                        setEmail('admin@teacherclone.edu');
                      } else if (role === 'teacher') {
                        setEmail('dr.rao@teacherclone.edu');
                      } else {
                        setEmail('student@teacherclone.edu');
                      }
                      setPassword('password123');
                    }}
                    style={{
                      background: 'var(--color-accent-glow)',
                      color: 'var(--color-accent)',
                      border: '1px solid var(--color-accent)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Autofill
                  </button>
                </div>
              )}
              
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="login-error-box"
                  >
                    <ShieldCheck size={15} />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Google Sign-In button (sign-in mode only) ── */}
              {!isSignUp && (
                <>
                  <button
                    type="button"
                    id="btn-google-signin"
                    className="btn-google"
                    onClick={handleGoogleAuth}
                    disabled={loading}
                  >
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" fill="#FFC107"/>
                      <path d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" fill="#FF3D00"/>
                      <path d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.4 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.5C9.8 37.6 16.4 44 24 44z" fill="#4CAF50"/>
                      <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.2 5.2C40.7 35.7 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z" fill="#1976D2"/>
                    </svg>
                    Continue with Google
                  </button>
                  <div className="auth-divider">
                    <span>or continue with email</span>
                  </div>
                </>
              )}

              {isSignUp && (
                <div className="input-group">
                  <label htmlFor="login-name">Full Name</label>
                  <div className="input-wrapper">
                    <User size={17} className="field-icon" />
                    <input
                      id="login-name"
                      type="text"
                      placeholder="Your name"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label htmlFor="login-email">Email address</label>
                <div className="input-wrapper">
                  <Mail size={17} className="field-icon" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@institution.edu"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <div className="label-row">
                  <label htmlFor="login-password">Password</label>
                  {!isSignUp && <a href="#" className="text-link">Forgot?</a>}
                </div>
                <div className="input-wrapper">
                  <Lock size={17} className="field-icon" />
                  <input
                    id="login-password"
                    type="password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                className="btn-primary"
                id="login-submit"
                disabled={loading}
                whileHover={!loading ? { scale: 1.02 } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
                style={{ width: "100%", justifyContent: "center", padding: "13px 20px" }}
              >
                {loading ? (
                  <div className="spinner" />
                ) : (
                  <>
                    <span>{isSignUp ? "Create account & Sign In" : "Enter the system"}</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </motion.button>

              <div style={{ marginTop: 'var(--space-md)', textAlign: 'center', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--color-muted)' }}>
                  {isSignUp ? "Already have an account? " : "Don't have an account? "}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontWeight: 600
                  }}
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </div>
            </form>
          </motion.main>
        )}
      </AnimatePresence>

      <footer className="global-footer">
        © 2026 TeacherClone Systems · Secure Academic Environment
      </footer>
    </div>
  );
}

export default Login;
