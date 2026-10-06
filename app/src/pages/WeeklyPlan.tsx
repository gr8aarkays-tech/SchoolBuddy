import React, { useState } from 'react';
import { Calendar, CheckCircle, Clock, AlertTriangle, BookOpen, Filter, Plus, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Modal } from '../components/shared/UI';
import type { StudyStatus, WeeklyLesson } from '../types';
import { STUDY_STATUS_LABELS } from '../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SUBJECTS = ['All', 'Mathematics', 'English', 'EVS', 'Science', 'Social Studies', 'Hindi', 'Kannada', 'Telugu'];
const SUBJECTS_FORM = SUBJECTS.slice(1); // without "All"
const STATUSES: StudyStatus[] = ['not_started', 'in_progress', 'needs_revision', 'completed'];

export function WeeklyPlan() {
  const { selectedChild, getChildWeeklyLessons, addWeeklyLesson, updateWeeklyLesson } = useApp();
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [addOpen, setAddOpen] = useState(false);

  if (!selectedChild) return <div className="card text-center py-10 text-gray-500">Please select a child first.</div>;

  const lessons = getChildWeeklyLessons(selectedChild.id);

  const filtered = lessons.filter(l => {
    if (filterSubject !== 'All' && l.subject !== filterSubject) return false;
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    return true;
  });

  const grouped = DAYS.reduce((acc, day) => {
    acc[day] = filtered.filter(l => l.day === day);
    return acc;
  }, {} as Record<string, typeof lessons>);

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = lessons.filter(l => l.status === s).length;
    return acc;
  }, {} as Record<StudyStatus, number>);

  const statusIcon = (s: StudyStatus) => {
    if (s === 'completed') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (s === 'in_progress') return <Clock className="w-4 h-4 text-blue-500" />;
    if (s === 'needs_revision') return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <BookOpen className="w-4 h-4 text-gray-400" />;
  };

  const subjectColors: Record<string, string> = {
    Mathematics: 'bg-blue-500',
    English: 'bg-green-500',
    EVS: 'bg-emerald-500',
    Science: 'bg-purple-500',
    'Social Studies': 'bg-orange-500',
    Hindi: 'bg-red-500',
    Kannada: 'bg-yellow-500',
    Telugu: 'bg-pink-500',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div /> {/* spacer */}
        <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Lesson
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map(s => (
          <div key={s} className="card flex items-center gap-3">
            {statusIcon(s)}
            <div>
              <p className="text-lg font-bold text-gray-900">{statusCounts[s]}</p>
              <p className="text-xs text-gray-500">{STUDY_STATUS_LABELS[s]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filter:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(sub => (
              <button
                key={sub}
                onClick={() => setFilterSubject(sub)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filterSubject === sub ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {sub}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFilterStatus('all')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filterStatus === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
            {STATUSES.map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {STUDY_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly calendar */}
      <div className="space-y-4">
        {DAYS.map(day => {
          const dayLessons = grouped[day] || [];
          if (dayLessons.length === 0) return null;
          return (
            <div key={day} className="card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
                <h3 className="font-semibold text-gray-900">{day}</h3>
                {dayLessons.some(l => l.homeworkDue) && (
                  <span className="badge bg-orange-100 text-orange-700 text-xs ml-auto">📝 Homework Due</span>
                )}
              </div>
              <div className="space-y-2">
                {dayLessons.map(lesson => (
                  <div key={lesson.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    lesson.status === 'completed' ? 'bg-green-50 border-green-200' :
                    lesson.status === 'needs_revision' ? 'bg-yellow-50 border-yellow-200' :
                    lesson.status === 'in_progress' ? 'bg-blue-50 border-blue-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className={`w-3 h-8 rounded-full flex-shrink-0 ${subjectColors[lesson.subject] || 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{lesson.topic}</p>
                      <p className="text-xs text-gray-500">{lesson.subject} · {lesson.chapter}</p>
                      {lesson.homeworkDue && <p className="text-xs text-orange-600 font-medium">📝 Homework due</p>}
                    </div>
                    <select
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white flex-shrink-0"
                      value={lesson.status}
                      onChange={e => updateWeeklyLesson(lesson.id, { status: e.target.value as StudyStatus })}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{STUDY_STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card text-center py-8 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
            {lessons.length === 0
              ? <><p className="font-medium mb-2">No lessons yet</p><button onClick={() => setAddOpen(true)} className="btn-primary text-sm mx-auto">Add First Lesson</button></>
              : <p>No lessons match the selected filters.</p>
            }
          </div>
        )}
      </div>

      <AddLessonModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        childId={selectedChild.id}
        onSave={addWeeklyLesson}
      />
    </div>
  );
}

// ─── Add Lesson Modal ─────────────────────────────────────────────────────────

function AddLessonModal({ open, onClose, childId, onSave }: {
  open: boolean;
  onClose: () => void;
  childId: string;
  onSave: (lesson: WeeklyLesson) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const [form, setForm] = useState({
    day: DAYS.includes(todayDay) ? todayDay : 'Monday',
    date: today,
    subject: 'Mathematics',
    topic: '',
    chapter: '',
    status: 'not_started' as StudyStatus,
    homeworkDue: false,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.topic.trim() || !form.chapter.trim()) return;
    setSaving(true);
    await onSave({
      id: `wl-${Date.now()}`,
      childId,
      day: form.day,
      date: form.date,
      subject: form.subject,
      topic: form.topic.trim(),
      chapter: form.chapter.trim(),
      status: form.status,
      homeworkDue: form.homeworkDue,
      notes: form.notes.trim() || undefined,
    });
    setSaving(false);
    onClose();
    setForm({ day: DAYS.includes(todayDay) ? todayDay : 'Monday', date: today, subject: 'Mathematics', topic: '', chapter: '', status: 'not_started', homeworkDue: false, notes: '' });
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Lesson">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Day</label>
            <select className="select" value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))}>
              {DAYS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Subject *</label>
            <select className="select" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
              {SUBJECTS_FORM.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StudyStatus }))}>
              {STATUSES.map(s => <option key={s} value={s}>{STUDY_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Topic *</label>
          <input type="text" className="input" placeholder="e.g. 6× multiplication tables" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
        </div>
        <div>
          <label className="label">Chapter *</label>
          <input type="text" className="input" placeholder="e.g. Multiplication" value={form.chapter} onChange={e => setForm(f => ({ ...f, chapter: e.target.value }))} />
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <input type="text" className="input" placeholder="Any extra notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input type="checkbox" className="w-4 h-4 rounded" checked={form.homeworkDue} onChange={e => setForm(f => ({ ...f, homeworkDue: e.target.checked }))} />
          Homework due for this lesson
        </label>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.topic.trim() || !form.chapter.trim() || saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Add Lesson'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
