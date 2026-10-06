import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, GraduationCap, BookOpen, FileQuestion,
  AlertTriangle, CheckCircle, FileText, Zap, X, Sparkles,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useSettings } from '../contexts/SettingsContext';
import { ProgressBar, SectionHeader } from '../components/shared/UI';
import { MATERIAL_TYPE_LABELS, EXAM_TYPE_LABELS } from '../types';

const LOCAL_AI_BANNER_KEY = 'sanju_local_ai_banner_dismissed';

// ── Per-subject emoji + color ───────────────────────────────────────────────
const SUBJECT_META: Record<string, { emoji: string; color: string }> = {
  Mathematics:     { emoji: '🔢', color: '#3b82f6' },
  English:         { emoji: '📖', color: '#10b981' },
  EVS:             { emoji: '🌿', color: '#22c55e' },
  Science:         { emoji: '🔬', color: '#8b5cf6' },
  'Social Studies':{ emoji: '🌍', color: '#f59e0b' },
  Hindi:           { emoji: '🇮🇳', color: '#ef4444' },
  Kannada:         { emoji: '🌸', color: '#ec4899' },
  Telugu:          { emoji: '🌺', color: '#f97316' },
};

// Fun greetings based on time of day
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', emoji: '🌅' };
  if (h < 17) return { text: 'Good afternoon', emoji: '☀️' };
  return { text: 'Good evening', emoji: '🌙' };
}

// Motivational quote cycle
const MOTIVATIONAL = [
  { quote: 'Every expert was once a beginner.', emoji: '🌱' },
  { quote: 'Reading is to the mind what exercise is to the body.', emoji: '💪' },
  { quote: 'Practice makes perfect!', emoji: '⭐' },
  { quote: 'Learning is a treasure that follows its owner everywhere.', emoji: '🏆' },
  { quote: 'The more that you read, the more things you will know.', emoji: '📚' },
];

export function Dashboard() {
  const { selectedChild, getChildExams, getChildMaterials, getChildSubjects, getSubjectChapters, getChapterTopics, getChildQuestionPapers } = useApp();
  const { settings } = useSettings();
  const greeting = getGreeting();
  const quote = MOTIVATIONAL[new Date().getDay() % MOTIVATIONAL.length];

  // Show banner only when provider is not already 'local', and user hasn't dismissed it
  const showBannerInitially =
    settings.aiProvider !== 'local' &&
    !localStorage.getItem(LOCAL_AI_BANNER_KEY);
  const [bannerVisible, setBannerVisible] = useState(showBannerInitially);

  const dismissBanner = () => {
    localStorage.setItem(LOCAL_AI_BANNER_KEY, '1');
    setBannerVisible(false);
  };

  if (!selectedChild) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-7xl mb-4 animate-bounce">🎒</div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>No child selected</h2>
        <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>Add your child to get started!</p>
        <Link to="/children" className="btn-primary">👶 Manage Children</Link>
      </div>
    );
  }

  const exams = getChildExams(selectedChild.id);
  const materials = getChildMaterials(selectedChild.id);
  const subjects = getChildSubjects(selectedChild.id);
  const questionPapers = getChildQuestionPapers(selectedChild.id);

  const upcomingExam = exams.find(e => e.preparationStatus !== 'completed');
  const pendingMaterials = materials.filter(m => m.processingStatus === 'requires_review').length;
  const recentMaterials = materials.slice(0, 3);

  const attentionTopics: { topic: string; subject: string; chapter: string }[] = [];
  subjects.forEach(sub => {
    getSubjectChapters(sub.id).forEach(ch => {
      getChapterTopics(ch.id)
        .filter(t => t.studyStatus === 'needs_revision' || t.studyStatus === 'not_started')
        .forEach(t => attentionTopics.push({ topic: t.name, subject: sub.name, chapter: ch.name }));
    });
  });

  const subjectProgress = subjects.map(sub => {
    const chs = getSubjectChapters(sub.id);
    const allTopics = chs.flatMap(c => getChapterTopics(c.id));
    const done = allTopics.filter(t => t.studyStatus === 'completed').length;
    const pct = allTopics.length ? Math.round((done / allTopics.length) * 100) : 0;
    return { subject: sub, progress: pct, total: allTopics.length, done };
  });

  const daysToExam = upcomingExam
    ? Math.max(0, Math.ceil((new Date(upcomingExam.startDate).getTime() - Date.now()) / 86400000))
    : null;

  const overallProgress = subjectProgress.length
    ? Math.round(subjectProgress.reduce((s, p) => s + p.progress, 0) / subjectProgress.length)
    : 0;

  return (
    <div className="space-y-5">

      {/* ── Local AI promo banner (one-time, dismissible) ─────────────── */}
      {bannerVisible && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-blue-800">✨ Try Free Local AI</span>
            <span className="text-sm text-blue-700"> — works offline, no subscription needed. </span>
            <Link to="/settings" className="text-sm font-semibold text-blue-600 underline underline-offset-2">
              Set up in Settings →
            </Link>
          </div>
          <button
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Welcome banner ────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)' }}
      >
        {/* Decorative floating emojis */}
        <span className="absolute right-4 top-3 text-4xl opacity-20 select-none">🎓</span>
        <span className="absolute right-16 bottom-2 text-3xl opacity-15 select-none">⭐</span>
        <span className="absolute right-8 top-12 text-2xl opacity-10 select-none">📚</span>

        <p className="text-white/80 text-sm mb-0.5">{greeting.emoji} {greeting.text}!</p>
        <h2 className="text-xl font-bold mb-1">
          {selectedChild.name}'s Learning Dashboard 🚀
        </h2>
        <p className="text-white/70 text-xs">Class {selectedChild.class} · {selectedChild.school}</p>

        {/* Motivational quote */}
        <div className="mt-3 pt-3 border-t border-white/20 flex items-start gap-2">
          <span className="text-xl">{quote.emoji}</span>
          <p className="text-white/80 text-xs italic">"{quote.quote}"</p>
        </div>
      </div>

      {/* ── Overall progress ring + quick stats ───────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickStat emoji="🎓" label="Upcoming Exam"
          value={upcomingExam ? upcomingExam.name.split('–')[0].trim() : 'None'}
          sub={daysToExam !== null ? `${daysToExam} days away` : 'No exam scheduled'}
          color="blue" />
        <QuickStat emoji="⚠️" label="Needs Review"
          value={pendingMaterials.toString()}
          sub="uploaded materials"
          color="yellow" />
        <QuickStat emoji="📝" label="Question Papers"
          value={questionPapers.length.toString()}
          sub="generated"
          color="purple" />
        <QuickStat emoji="🎯" label="Overall Progress"
          value={`${overallProgress}%`}
          sub={`${attentionTopics.length} topics pending`}
          color="green" />
      </div>

      {/* ── Urgent exam warning ────────────────────────────────────────── */}
      {daysToExam !== null && daysToExam <= 7 && upcomingExam && (
        <div className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '1px solid #fbbf24' }}>
          <span className="text-3xl">⏰</span>
          <div>
            <p className="font-bold text-amber-900">Exam alert! Only {daysToExam} day{daysToExam !== 1 ? 's' : ''} left!</p>
            <p className="text-sm text-amber-800">{upcomingExam.name} — time to revise! 💪</p>
          </div>
          <Link to="/exam-prep" className="ml-auto btn-primary text-xs">Prepare Now →</Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">

        {/* ── Subject progress ─────────────────────────────────────────── */}
        <div className="card">
          <SectionHeader
            title="📊 Study Progress"
            action={<Link to="/study-guide" className="text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>Study Guide →</Link>}
          />
          <div className="space-y-3">
            {subjectProgress.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No subjects added yet</p>
            ) : (
              subjectProgress.map(({ subject, progress, total, done }) => {
                const meta = SUBJECT_META[subject.name] || { emoji: '📚', color: '#6b7280' };
                return (
                  <div key={subject.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                        <span>{meta.emoji}</span> {subject.name}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {done}/{total}
                        {progress === 100 ? ' 🏆' : progress >= 60 ? ' 🌟' : ''}
                      </span>
                    </div>
                    <ProgressBar value={progress} showLabel
                      color={progress === 100 ? 'bg-green-500' : progress >= 60 ? 'bg-blue-500' : 'bg-amber-400'}
                      size="sm" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Upcoming exam ────────────────────────────────────────────── */}
        {upcomingExam ? (
          <div className="card">
            <SectionHeader
              title="📅 Upcoming Exam"
              action={<Link to="/exam-prep" className="text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>View all →</Link>}
            />
            <div className="p-4 rounded-xl" style={{ background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', border: '1px solid #fed7aa' }}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">📋</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-orange-900">{upcomingExam.name}</p>
                  <p className="text-xs text-orange-700 mb-2">
                    {EXAM_TYPE_LABELS[upcomingExam.examType]} · {new Date(upcomingExam.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {upcomingExam.subjects.map(s => {
                      const meta = SUBJECT_META[s.subjectName] || { emoji: '📚' };
                      return (
                        <span key={s.subjectId} className="badge-blue text-xs">
                          {meta.emoji} {s.subjectName}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {upcomingExam.subjects.slice(0, 3).map(s => (
                <div key={s.subjectId} className="rounded-lg p-2" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>{s.subjectName}</p>
                  <p className="text-lg font-bold" style={{ color: s.practiceCompleted >= 60 ? '#16a34a' : '#d97706' }}>
                    {s.practiceCompleted}%
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>done</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center py-8 text-center">
            <span className="text-5xl mb-3">🎉</span>
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>No upcoming exams!</p>
            <p className="text-sm mt-1 mb-3" style={{ color: 'var(--color-text-muted)' }}>Great time to get ahead 💪</p>
            <Link to="/exam-prep" className="btn-secondary text-xs">+ Add Exam</Link>
          </div>
        )}

        {/* ── Topics needing attention ─────────────────────────────────── */}
        <div className="card">
          <SectionHeader
            title="⚡ Topics to Revise"
            action={<Link to="/study-guide" className="text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>Study Guide →</Link>}
          />
          {attentionTopics.length === 0 ? (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
              <span className="text-2xl">🥳</span>
              <div>
                <p className="font-medium text-green-700">All caught up!</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>All topics are on track</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {attentionTopics.slice(0, 5).map((item, i) => {
                const meta = SUBJECT_META[item.subject] || { emoji: '📚' };
                return (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl"
                    style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    <span className="text-lg flex-shrink-0">{meta.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{item.topic}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.subject} · {item.chapter}</p>
                    </div>
                    <span className="ml-auto text-base">🔄</span>
                  </div>
                );
              })}
              {attentionTopics.length > 5 && (
                <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                  +{attentionTopics.length - 5} more topics to revise
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Recent uploads ───────────────────────────────────────────── */}
        <div className="card">
          <SectionHeader
            title="📂 Recent Uploads"
            action={<Link to="/upload" className="text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>Upload more →</Link>}
          />
          {recentMaterials.length === 0 ? (
            <div className="text-center py-5">
              <span className="text-4xl">📤</span>
              <p className="text-sm mt-2 mb-3" style={{ color: 'var(--color-text-muted)' }}>No uploads yet</p>
              <Link to="/upload" className="btn-primary text-xs">Upload Materials</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentMaterials.map(mat => {
                const icon = mat.fileType === 'pdf' ? '📄' : mat.fileType === 'link' ? '🔗' : '🖼';
                const statusEmoji = mat.processingStatus === 'processed' ? '✅' : mat.processingStatus === 'requires_review' ? '⚠️' : '⏳';
                return (
                  <div key={mat.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                    style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    <span className="text-xl flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{mat.fileName}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{MATERIAL_TYPE_LABELS[mat.materialType]}</p>
                    </div>
                    <span className="text-base flex-shrink-0">{statusEmoji}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="section-title">⚡ Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: '/upload',             emoji: '📤', label: 'Upload\nMaterial',    bg: '#dbeafe', fg: '#1e40af' },
            { to: '/question-generator', emoji: '📝', label: 'Generate\nQuestions', bg: '#ede9fe', fg: '#5b21b6' },
            { to: '/study-guide',        emoji: '📖', label: 'Study\nGuide',        bg: '#dcfce7', fg: '#166534' },
            { to: '/exam-prep',          emoji: '🎓', label: 'Exam\nPrep',          bg: '#fef3c7', fg: '#92400e' },
          ].map(({ to, emoji, label, bg, fg }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-2 p-4 rounded-xl font-medium text-sm transition-all hover:scale-105 active:scale-95 text-center"
              style={{ backgroundColor: bg, color: fg }}
            >
              <span className="text-3xl">{emoji}</span>
              <span className="leading-tight whitespace-pre-line">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Fun learning streak ──────────────────────────────────────────── */}
      <div className="rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
        style={{ background: 'linear-gradient(135deg,#fdf4ff,#ede9fe)', border: '1px solid #ddd6fe' }}>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-3xl sm:text-4xl">🔥</span>
          <div className="flex-1 sm:hidden">
            <p className="font-bold text-purple-900 leading-tight">Keep it up, {selectedChild.name}!</p>
            <p className="text-xs text-purple-700">Every question counts! 🌟</p>
          </div>
        </div>
        <div className="hidden sm:block flex-1">
          <p className="font-bold text-purple-900">Keep it up, {selectedChild.name}!</p>
          <p className="text-sm text-purple-700">Every question you practice brings you closer to the top! 🌟</p>
        </div>
        <Link to="/practice" className="w-full sm:w-auto text-center flex-shrink-0 px-4 py-2 rounded-xl font-semibold text-sm text-white"
          style={{ backgroundColor: '#7c3aed' }}>
          Practice Now 💪
        </Link>
      </div>

    </div>
  );
}

// ── QuickStat card ────────────────────────────────────────────────────────────
function QuickStat({ emoji, label, value, sub, color }: {
  emoji: string; label: string; value: string; sub: string; color: string;
}) {
  const bg: Record<string, string> = {
    blue: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',
    yellow: 'linear-gradient(135deg,#fef9c3,#fde68a)',
    purple: 'linear-gradient(135deg,#f3e8ff,#ddd6fe)',
    green: 'linear-gradient(135deg,#dcfce7,#bbf7d0)',
    red: 'linear-gradient(135deg,#fee2e2,#fecaca)',
  };
  const fg: Record<string, string> = {
    blue: '#1e40af', yellow: '#92400e', purple: '#5b21b6', green: '#166534', red: '#991b1b',
  };
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: bg[color] || bg.blue, border: '1px solid rgba(0,0,0,0.06)' }}>
      <span className="text-2xl">{emoji}</span>
      <p className="text-xs font-medium" style={{ color: fg[color] }}>{label}</p>
      <p className="text-lg font-bold leading-tight" style={{ color: fg[color] }}>{value}</p>
      <p className="text-[11px]" style={{ color: fg[color], opacity: 0.75 }}>{sub}</p>
    </div>
  );
}
