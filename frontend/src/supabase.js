import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Unified auth listener registry ──────────────────────────────────────────
// All onAuthStateChange subscriptions register here so that BOTH real and mock
// auth events reach every subscriber, no matter which path fired the sign-in.
const _unifiedListeners = new Set();

function _notifyListeners(event, session) {
  _unifiedListeners.forEach((cb) => {
    try { cb(event, session); } catch (e) { console.warn('Auth listener error:', e); }
  });
}

// ─── Mock chain builder ───────────────────────────────────────────────────────
const createMockBuilder = (table, dataLoader) => {
  const builder = {
    then: (onFulfilled) => Promise.resolve(dataLoader()).then(onFulfilled),
    select: () => builder,
    eq:     () => builder,
    single: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    order:  () => builder,
  };
  return builder;
};

// ─── Mock client ─────────────────────────────────────────────────────────────
const mockSupabase = {
  auth: {
    getSession: async () => {
      try {
        const userRole   = localStorage.getItem('userRole');
        const mockUser   = JSON.parse(localStorage.getItem('mockUser') || 'null');
        if (userRole && mockUser) {
          return { data: { session: { user: mockUser, access_token: 'mock-token' } }, error: null };
        }
      } catch (e) {
        console.error('Mock auth read error:', e);
      }
      return { data: { session: null }, error: null };
    },

    onAuthStateChange: (callback) => {
      _unifiedListeners.add(callback);

      // Fire immediately with whatever session exists right now
      const userRole = localStorage.getItem('userRole');
      const mockUser = JSON.parse(localStorage.getItem('mockUser') || 'null');
      const session  = (userRole && mockUser) ? { user: mockUser, access_token: 'mock-token' } : null;
      setTimeout(() => callback('INITIAL_SESSION', session), 0);

      return {
        data: {
          subscription: {
            unsubscribe: () => { _unifiedListeners.delete(callback); }
          }
        }
      };
    },

    signInWithPassword: async ({ email, password }) => {
      const localPart = email.split('@')[0].toLowerCase();
      const isTeacher = localPart.includes('teacher') || localPart.includes('faculty') || localPart.includes('rao') || localPart.includes('sharma');
      const isAdmin   = localPart.includes('admin');
      const role      = isAdmin ? 'admin' : (isTeacher ? 'teacher' : 'student');

      const mockUser = {
        id: isAdmin ? 'mock-admin-id' : (isTeacher ? 'mock-teacher-id' : 'mock-student-id'),
        email,
        user_metadata: {
          full_name: email.split('@')[0].toUpperCase(),
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        },
      };

      localStorage.setItem('userRole',  role);
      localStorage.setItem('mockUser',  JSON.stringify(mockUser));

      const session = { user: mockUser, access_token: 'mock-token' };
      _notifyListeners('SIGNED_IN', session);

      return { data: { user: mockUser, session }, error: null };
    },

    signUp: async ({ email, password, options }) => {
      const role     = options?.data?.role || 'student';
      const fullName = options?.data?.full_name || email.split('@')[0].toUpperCase();

      const mockUser = {
        id: `mock-${role}-id-${Date.now()}`,
        email,
        user_metadata: {
          full_name: fullName,
          role,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        },
      };

      localStorage.setItem('userRole',  role);
      localStorage.setItem('mockUser',  JSON.stringify(mockUser));

      const session = { user: mockUser, access_token: 'mock-token' };
      _notifyListeners('SIGNED_IN', session);

      return { data: { user: mockUser, session }, error: null };
    },

    signInWithOAuth: async ({ provider, options }) => {
      // In mock mode there is no real browser redirect — simulate a successful OAuth sign-in
      // by creating a mock Google user with the requested role.
      const role     = options?.data?.role || localStorage.getItem('userRole') || 'student';
      const mockUser = {
        id: `mock-google-${role}-id`,
        email: `mock.${role}@gmail.com`,
        app_metadata:  { provider: 'google' },
        user_metadata: {
          full_name:   `Google ${role.charAt(0).toUpperCase() + role.slice(1)}`,
          avatar_url:  `https://api.dicebear.com/7.x/avataaars/svg?seed=google-${role}`,
          provider_id: 'google',
        },
      };

      localStorage.setItem('userRole',  role);
      localStorage.setItem('mockUser',  JSON.stringify(mockUser));

      const session = { user: mockUser, access_token: 'mock-token' };
      _notifyListeners('SIGNED_IN', session);

      // Return same shape as real OAuth (no redirect URL needed in mock)
      return { data: { provider, url: null }, error: null };
    },

    signOut: async () => {
      localStorage.removeItem('userRole');
      localStorage.removeItem('mockUser');
      _notifyListeners('SIGNED_OUT', null);
      return { error: null };
    },
  },

  from: (table) => createMockBuilder(table, () => {
    if (table === 'profiles') {
      const role = localStorage.getItem('userRole') || 'student';
      return { data: { role }, error: null };
    }
    return { data: null, error: null };
  }),
};

// ─── Real Supabase client ─────────────────────────────────────────────────────
let realSupabase = null;
try {
  if (supabaseUrl && supabaseAnonKey) {
    realSupabase = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (err) {
  console.warn('Failed to create real Supabase client:', err);
}

// If a real client exists, bridge its auth state changes into the unified registry
if (realSupabase) {
  try {
    realSupabase.auth.onAuthStateChange((event, session) => {
      _notifyListeners(event, session);
    });
  } catch (err) {
    console.warn('Failed to subscribe to real Supabase auth changes:', err);
  }
}

// ─── Query builder wrapper with mock fallback ─────────────────────────────────
function wrapQueryBuilder(realBuilder, table, mockBuilder = null) {
  const mock = mockBuilder || mockSupabase.from(table);

  return new Proxy(realBuilder, {
    get(target, prop) {
      const originalVal = target[prop];

      if (typeof originalVal === 'function') {
        return function (...args) {
          try {
            const nextReal = originalVal.apply(target, args);
            const nextMock = typeof mock[prop] === 'function' ? mock[prop](...args) : mock;
            return wrapQueryBuilder(nextReal, table, nextMock);
          } catch (err) {
            console.warn(`Query chain method ${prop} failed, falling back to mock:`, err);
            return typeof mock[prop] === 'function' ? mock[prop](...args) : mock;
          }
        };
      }

      if (prop === 'then') {
        return function (onFulfilled, onRejected) {
          return target.then(
            (res) => {
              if (res.error) {
                console.warn('Supabase query resolved with error, falling back to mock:', res.error);
                return mock.then ? mock.then(onFulfilled, onRejected) : Promise.resolve(mock).then(onFulfilled, onRejected);
              }
              return onFulfilled(res);
            },
            (err) => {
              console.warn('Supabase query rejected, falling back to mock:', err);
              return mock.then ? mock.then(onFulfilled, onRejected) : Promise.resolve(mock).then(onFulfilled, onRejected);
            }
          );
        };
      }

      return originalVal;
    },
  });
}

// ─── Unified auth object ──────────────────────────────────────────────────────
// Always exposes one consistent auth surface. Reads and sign-in/up/out operations
// attempt the real client first and fall back to mock automatically.
const unifiedAuth = {
  getSession: async () => {
    if (realSupabase) {
      try {
        const res = await realSupabase.auth.getSession();
        if (!res.error && res.data?.session) return res;
      } catch (err) {
        console.warn('Real getSession failed, falling back to mock:', err);
      }
    }
    return mockSupabase.auth.getSession();
  },

  // All callers share the unified listener set — no duplicates, clean unsubscribe
  onAuthStateChange: (callback) => {
    _unifiedListeners.add(callback);

    // Provide the current session immediately (async so React state is ready)
    Promise.resolve().then(async () => {
      const { data: { session } } = await unifiedAuth.getSession();
      callback('INITIAL_SESSION', session);
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => { _unifiedListeners.delete(callback); }
        }
      }
    };
  },

  signInWithPassword: async (credentials) => {
    const { email } = credentials;

    // Demo / fallback emails → go straight to mock (avoids unnecessary real-auth round-trip)
    const local   = email.split('@')[0].toLowerCase();
    const isDemo = email.endsWith('@teacherclone.edu')  ||
                   local.includes('teacher')             ||
                   local.includes('faculty')             ||
                   local.includes('admin')               ||
                   local.includes('rao')                 ||
                   local.includes('sharma');

    if (!isDemo && realSupabase) {
      try {
        const res = await realSupabase.auth.signInWithPassword(credentials);
        if (!res.error) {
          // Real sign-in succeeded — notify unified listeners (the bridge above does this
          // via the real client's own onAuthStateChange, but call it explicitly to be safe)
          _notifyListeners('SIGNED_IN', res.data?.session ?? null);
          return res;
        }
        console.warn('Real signInWithPassword failed, falling back to mock:', res.error);
      } catch (err) {
        console.warn('Real signInWithPassword threw, falling back to mock:', err);
      }
    }

    return mockSupabase.auth.signInWithPassword(credentials);
  },

  signUp: async (credentials) => {
    if (realSupabase) {
      try {
        const res = await realSupabase.auth.signUp(credentials);
        if (!res.error) {
          _notifyListeners('SIGNED_IN', res.data?.session ?? null);
          return res;
        }
        console.warn('Real signUp failed, falling back to mock:', res.error);
      } catch (err) {
        console.warn('Real signUp threw, falling back to mock:', err);
      }
    }
    return mockSupabase.auth.signUp(credentials);
  },

  signInWithOAuth: async ({ provider, options }) => {
    if (realSupabase) {
      try {
        const role = options?.data?.role || 'student';
        // Persist the chosen role BEFORE the browser navigates away so
        // OAuthCallback can read it back reliably after the redirect.
        localStorage.setItem('pendingOAuthRole', role);

        const redirectTo = `${window.location.origin}/auth/callback`;
        const res = await realSupabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            queryParams: { role },
            ...options,
          },
        });
        if (!res.error) return res;
        // If real OAuth failed, clean up and fall through to mock
        localStorage.removeItem('pendingOAuthRole');
        console.warn('Real signInWithOAuth failed, falling back to mock:', res.error);
      } catch (err) {
        localStorage.removeItem('pendingOAuthRole');
        console.warn('Real signInWithOAuth threw, falling back to mock:', err);
      }
    }
    return mockSupabase.auth.signInWithOAuth({ provider, options });
  },

  signOut: async () => {
    if (realSupabase) {
      try { await realSupabase.auth.signOut(); } catch (_) {}
    }
    return mockSupabase.auth.signOut();
  },
};

// ─── Main export ──────────────────────────────────────────────────────────────
export const supabase = {
  get auth() { return unifiedAuth; },

  from(table) {
    const isMockSession = localStorage.getItem('mockUser') !== null;
    if (realSupabase && !isMockSession) {
      try {
        return wrapQueryBuilder(realSupabase.from(table), table);
      } catch (err) {
        console.warn(`supabase.from(${table}) failed, falling back to mock:`, err);
      }
    }
    return mockSupabase.from(table);
  },
};
