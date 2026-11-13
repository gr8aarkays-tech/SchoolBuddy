import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = 'sanju_auth_user';
const TOKEN_KEY   = 'sanju_auth_token';

// The fixed ID used for the demo account so AppContext can detect it
export const DEMO_USER_ID = 'user-demo';

// ─── Backend URL ─────────────────────────────────────────────────────────────
// When VITE_API_URL is set (production / Render deployment) auth goes through
// the backend so the same account works on web AND Android.
// When it is absent the app falls back to localStorage-only mode (offline use).
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

function hasBackend(): boolean {
  return !!API_BASE;
}

// ─── Backend auth calls ───────────────────────────────────────────────────────

async function backendRegister(name: string, email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as { token: string; user: AuthUser };
}

async function backendLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as { token: string; user: AuthUser };
}

async function backendMe(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json() as AuthUser;
  } catch {
    return null;
  }
}

// ─── localStorage fallback (offline / no backend) ────────────────────────────
// Uses djb2 — intentionally weak, client-side only demo hash.
// If you never set VITE_API_URL this is the only auth path.

interface StoredUser extends AuthUser { passwordHash: string; }
const USERS_KEY = 'sanju_registered_users';

function djb2(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h << 5, h) + h + s.charCodeAt(i); h |= 0; }
  return h.toString(36);
}
function getLocalUsers(): StoredUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
}
function saveLocalUsers(u: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
}
function seedDemo() {
  const users = getLocalUsers();
  if (!users.some(u => u.id === DEMO_USER_ID)) {
    saveLocalUsers([{ id: DEMO_USER_ID, name: 'Demo User', email: 'tester@test.com', createdAt: '2024-01-01T00:00:00Z', passwordHash: djb2('test123') }, ...users]);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        if (hasBackend()) {
          // Try to restore from stored token
          const token = localStorage.getItem(TOKEN_KEY);
          if (token) {
            const me = await backendMe(token);
            if (me) { setUser(me); setIsLoading(false); return; }
            // Token expired/invalid — clear it
            localStorage.removeItem(TOKEN_KEY);
          }
        } else {
          // Offline fallback
          seedDemo();
          const stored = localStorage.getItem(SESSION_KEY);
          if (stored) setUser(JSON.parse(stored));
        }
      } catch { /* ignore */ }
      setIsLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    await delay(200); // tiny UX delay so the spinner shows
    try {
      if (hasBackend()) {
        const { token, user: u } = await backendLogin(email, password);
        localStorage.setItem(TOKEN_KEY, token);
        setUser(u);
        return { success: true };
      } else {
        // localStorage fallback
        const users = getLocalUsers();
        const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === djb2(password));
        if (!found) return { success: false, error: 'Invalid email or password.' };
        const { passwordHash: _, ...authUser } = found;
        localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
        setUser(authUser);
        return { success: true };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Login failed.' };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    await delay(200);
    if (!name.trim())           return { success: false, error: 'Name is required.' };
    if (!email.includes('@'))   return { success: false, error: 'Enter a valid email address.' };
    if (password.length < 6)   return { success: false, error: 'Password must be at least 6 characters.' };
    try {
      if (hasBackend()) {
        const { token, user: u } = await backendRegister(name, email, password);
        localStorage.setItem(TOKEN_KEY, token);
        setUser(u);
        return { success: true };
      } else {
        // localStorage fallback
        const users = getLocalUsers();
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
          return { success: false, error: 'An account with this email already exists.' };
        }
        const newUser: StoredUser = { id: `user-${Date.now()}`, name: name.trim(), email: email.toLowerCase(), createdAt: new Date().toISOString(), passwordHash: djb2(password) };
        saveLocalUsers([...users, newUser]);
        const { passwordHash: _, ...authUser } = newUser;
        localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
        setUser(authUser);
        return { success: true };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Registration failed.' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function delay(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }
