import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [role, setRole]       = useState(localStorage.getItem('userRole'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Drive all auth state from onAuthStateChange — this fires INITIAL_SESSION on mount
    // (covering both real and mock sessions), then subsequent SIGNED_IN / SIGNED_OUT events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);

      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('userRole');
        setRole(null);
      } else if (session?.user) {
        // Try to fetch the canonical role from the profiles table
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          if (profile?.role) {
            setRole(profile.role);
            localStorage.setItem('userRole', profile.role);
          }
        } catch (e) {
          console.warn('Error fetching role on auth change:', e);
        }
      }

      // Mark loading done once the first event is processed
      setLoading(false);
    });

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, setRole, supabase }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
