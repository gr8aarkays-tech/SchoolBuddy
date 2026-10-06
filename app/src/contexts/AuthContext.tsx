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

const STORAGE_KEY = 'sanju_auth_user';
const USERS_KEY = 'sanju_registered_users';

// The fixed ID used for the demo account so AppContext can detect it
export const DEMO_USER_ID = 'user-demo';

interface StoredUser extends AuthUser {
  passwordHash: string;
}

/**
 * Client-side password hashing — intentional limitations to be aware of:
 *  • Uses djb2, a fast non-cryptographic hash — NOT suitable for server-side auth.
 *  • No salt: identical passwords produce identical hashes (rainbow-table vulnerable).
 *  • Stored in localStorage: any XSS attack on the page can read the hash.
 *
 * This is intentional for a local-first demo app where all data lives on the
 * user's own device. If you add a real backend user table, replace this with
 * bcrypt/argon2 server-side with a per-user salt.
 */
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function getStoredUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Ensure the demo account always exists in localStorage */
function seedDemoAccount() {
  const users = getStoredUsers();
  const exists = users.some(u => u.id === DEMO_USER_ID);
  if (!exists) {
    const demoUser: StoredUser = {
      id: DEMO_USER_ID,
      name: 'Demo User',
      email: 'tester@test.com',
      createdAt: '2024-01-01T00:00:00Z',
      passwordHash: hashPassword('test123'),
    };
    saveStoredUsers([demoUser, ...users]);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Seed demo account and restore session on mount
  useEffect(() => {
    seedDemoAccount();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    await delay(600); // simulate network
    const users = getStoredUsers();
    const found = users.find(
      u => u.email.toLowerCase() === email.toLowerCase() &&
           u.passwordHash === hashPassword(password)
    );
    if (!found) {
      return { success: false, error: 'Invalid email or password.' };
    }
    const { passwordHash: _, ...authUser } = found;
    setUser(authUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    return { success: true };
  };

  const register = async (name: string, email: string, password: string) => {
    await delay(600);
    if (!name.trim()) return { success: false, error: 'Name is required.' };
    if (!email.includes('@')) return { success: false, error: 'Enter a valid email address.' };
    if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };

    const users = getStoredUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    const newUser: StoredUser = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      email: email.toLowerCase(),
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
    };
    saveStoredUsers([...users, newUser]);

    const { passwordHash: _, ...authUser } = newUser;
    setUser(authUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
