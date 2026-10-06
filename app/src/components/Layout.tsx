import React, { useState } from 'react';
import { NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { ThemePicker } from './shared/ThemePicker';
import { FloatingChat } from './shared/FloatingChat';
import {
  LayoutDashboard, Upload, Calendar, BookOpen,
  FileQuestion, Dumbbell, Library, Users, Settings,
  GraduationCap, Menu, X, ChevronDown, Bot, LogOut, User,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload Materials', icon: Upload },
  { to: '/weekly-plan', label: 'Weekly Plan', icon: Calendar },
  { to: '/exam-prep', label: 'Exam Preparation', icon: GraduationCap },
  { to: '/study-guide', label: 'Study Guide', icon: BookOpen },
  { to: '/question-generator', label: 'Question Generator', icon: FileQuestion },
  { to: '/practice', label: 'Practice Mode', icon: Dumbbell },
  { to: '/library', label: 'Question Library', icon: Library },
  { to: '/children', label: 'Children', icon: Users },
  { to: '/assistant', label: 'AI Assistant', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { selectedChild, children: childList, selectChild, loading: appLoading } = useApp();
  const { user, logout } = useAuth();
  const [childDropdownOpen, setChildDropdownOpen] = useState(false);
  const [slowConnecting, setSlowConnecting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Show cold-start backend connecting notice if API takes >1.5s
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (appLoading && user?.id !== 'user-demo') {
      timer = setTimeout(() => setSlowConnecting(true), 1500);
    } else {
      setSlowConnecting(false);
    }
    return () => clearTimeout(timer);
  }, [appLoading, user?.id]);

  // ── Fix 2: close child dropdown on outside click ──────────────────────────
  const childDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!childDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (childDropdownRef.current && !childDropdownRef.current.contains(e.target as Node)) {
        setChildDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [childDropdownOpen]);

  const currentPage = navItems.find(n =>
    n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)
  )?.label || 'Dashboard';

  // ── Fix 1: navigate to dashboard on logo click ────────────────────────────
  const handleLogoClick = () => {
    navigate('/');
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 flex flex-col transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}
        style={{
          backgroundColor: 'var(--color-sidebar-bg)',
          borderRight: '1px solid var(--color-sidebar-border)',
        }}
      >
        {/* Logo — Fix 1: clickable, navigates to dashboard */}
        <div
          className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:opacity-80 transition-opacity select-none"
          style={{ borderBottom: '1px solid var(--color-sidebar-border)' }}
          onClick={handleLogoClick}
          role="button"
          aria-label="Go to Dashboard"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--color-primary)' }}>
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--color-text)' }}>SchoolBuddy</p>
            <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>AI Learning Assistant</p>
          </div>
          <button
            className="ml-auto lg:hidden"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={e => { e.stopPropagation(); setSidebarOpen(false); }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Child selector — Fix 2: ref-based outside-click close */}
        <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--color-sidebar-border)' }}>
          <div className="relative" ref={childDropdownRef}>
            <button
              onClick={() => setChildDropdownOpen(v => !v)}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:opacity-80 text-left transition-opacity"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--color-primary-light)' }}>
                <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                  {selectedChild?.name.charAt(0) || '?'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                  {selectedChild?.name || 'Select Child'}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Class {selectedChild?.class}</p>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${childDropdownOpen ? 'rotate-180' : ''}`}
                style={{ color: 'var(--color-text-muted)' }}
              />
            </button>

            {childDropdownOpen && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 overflow-hidden"
                style={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
              >
                {childList.map((child: any) => (
                  <button
                    key={child.id}
                    onClick={() => { selectChild(child); setChildDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: selectedChild?.id === child.id ? 'var(--color-primary-light)' : 'transparent',
                      color: selectedChild?.id === child.id ? 'var(--color-primary-text)' : 'var(--color-text)',
                    }}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                    >
                      {child.name.charAt(0)}
                    </span>
                    <span>{child.name}</span>
                    <span className="ml-auto text-xs" style={{ color: 'var(--color-text-muted)' }}>Cl. {child.class}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all duration-150"
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--color-sidebar-active-bg)' : 'transparent',
                color: isActive ? 'var(--color-sidebar-active-text)' : 'var(--color-text-muted)',
              })}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3" style={{ borderTop: '1px solid var(--color-sidebar-border)' }}>
          <div className="flex items-center gap-2 p-2 rounded-lg">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--color-primary-light)' }}
            >
              <User className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>{user?.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{user?.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-lg hover:opacity-80 transition-opacity flex-shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          className="px-4 py-3 flex items-center gap-3 sticky top-0 z-30"
          style={{
            backgroundColor: 'var(--color-header-bg)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <button
            className="lg:hidden p-1 rounded-lg hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Fix 1: header title is also a home link */}
          <button
            className="text-base font-semibold hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text)' }}
            onClick={() => navigate('/')}
          >
            {currentPage}
          </button>

          <div className="ml-auto flex items-center gap-2">
            <ThemePicker />
            {selectedChild && (
              <span
                className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-text)' }}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {selectedChild.name.charAt(0)}
                </span>
                {selectedChild.name} · Class {selectedChild.class}
              </span>
            )}
          </div>
        </header>

        {/* Cold-start notification banner for cloud backend */}
        {slowConnecting && (
          <div className="bg-amber-500 text-white px-4 py-2 text-xs flex items-center justify-center gap-2 shadow-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>Connecting to cloud backend (free tier waking up, please wait a few seconds)…</span>
          </div>
        )}

        {/* Page */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Fix 4: Floating AI chatbot — always visible bottom-right */}
      <FloatingChat currentPage={currentPage} />
    </div>
  );
}

// Guard: wraps the Layout and redirects to /login if not authenticated
export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Layout>{children}</Layout>;
}
