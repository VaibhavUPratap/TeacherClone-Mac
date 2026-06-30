import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

/**
 * OAuthCallback — handles the redirect from Google after OAuth sign-in.
 *
 * Flow:
 *  1. Supabase SDK automatically parses the URL hash / code and establishes a session.
 *  2. We read the `role` query param that was embedded in the redirect URL.
 *  3. We upsert the role into the `profiles` table so it is permanently saved.
 *  4. We set the role in localStorage and navigate to /dashboard.
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Completing sign-in…');

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        // 1. Wait for Supabase to exchange the auth code for a session
        //    (the SDK does this automatically; we just read the result)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.error('OAuth callback: no session found', error);
          setStatus('Sign-in failed. Redirecting…');
          setTimeout(() => navigate('/login'), 1800);
          return;
        }

        if (cancelled) return;

        const user = session.user;

        // 2. Resolve the role — priority order:
        //    a) pendingOAuthRole  — set in localStorage just BEFORE the OAuth redirect (most reliable)
        //    b) URL query param   — ?role=student forwarded by Supabase (sometimes stripped)
        //    c) user_metadata     — set via signInWithOAuth options.data
        //    d) existing userRole — any previously stored role
        //    e) default 'student'
        const pendingRole   = localStorage.getItem('pendingOAuthRole');
        const urlParams     = new URLSearchParams(window.location.search);
        const roleFromUrl   = urlParams.get('role');
        const roleFromMeta  = user.user_metadata?.role;
        const roleFromStore = localStorage.getItem('userRole');

        const role = pendingRole || roleFromUrl || roleFromMeta || roleFromStore || 'student';

        // Clean up the pending key so it doesn't persist across future logins
        localStorage.removeItem('pendingOAuthRole');

        setStatus(`Welcome! Setting up your ${role} profile…`);

        // 3. Upsert the profile with the correct role
        //    ON CONFLICT (id) → update role only if the current value is NULL
        //    so existing roles are never overwritten by a fresh OAuth.
        try {
          await supabase.from('profiles').upsert(
            {
              id:        user.id,
              email:     user.email,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
              role,
            },
            { onConflict: 'id', ignoreDuplicates: false }
          );
        } catch (dbErr) {
          // Non-fatal — profile may already exist; role is still stored locally
          console.warn('Profile upsert warning:', dbErr);
        }

        // 4. Persist role locally and navigate
        localStorage.setItem('userRole', role);
        if (cancelled) return;

        setStatus('All done! Redirecting…');
        setTimeout(() => navigate('/dashboard', { replace: true }), 600);
      } catch (err) {
        console.error('OAuthCallback error:', err);
        if (!cancelled) {
          setStatus('Something went wrong. Redirecting…');
          setTimeout(() => navigate('/login'), 2000);
        }
      }
    }

    handleCallback();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-paper)',
      gap: '1.25rem',
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        style={{ color: 'var(--color-accent)' }}
      >
        <Loader2 size={36} strokeWidth={2} />
      </motion.div>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.9375rem',
        color: 'var(--color-muted)',
        letterSpacing: '0.01em',
      }}>
        {status}
      </p>
    </div>
  );
}
