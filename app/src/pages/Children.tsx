import React, { useState } from 'react';
import { Users, Plus, Pencil, Trash2, GraduationCap, School, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Modal } from '../components/shared/UI';
import type { Child, Subject, Chapter } from '../types';

const CLASSES = ['KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const YEARS = ['2023-2024', '2024-2025', '2025-2026'];

export function Children() {
  const {
    children, selectedChild, selectChild, addChild, updateChild, deleteChild,
    getChildSubjects, getSubjectChapters, upsertSubject, upsertChapter,
  } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [editChild, setEditChild] = useState<Child | null>(null);
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);

  // Subject / chapter add state
  const [addSubjectForChild, setAddSubjectForChild] = useState<string | null>(null);
  const [addChapterForSubject, setAddChapterForSubject] = useState<{ childId: string; subjectId: string; subjectName: string } | null>(null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newChapterName, setNewChapterName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddSubject = async () => {
    if (!newSubjectName.trim() || !addSubjectForChild) return;
    setSaving(true);
    await upsertSubject(addSubjectForChild, newSubjectName.trim());
    setSaving(false);
    setNewSubjectName('');
    setAddSubjectForChild(null);
  };

  const handleAddChapter = async () => {
    if (!newChapterName.trim() || !addChapterForSubject) return;
    setSaving(true);
    await upsertChapter(addChapterForSubject.subjectId, newChapterName.trim());
    setSaving(false);
    setNewChapterName('');
    setAddChapterForSubject(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Child
        </button>
      </div>

      {children.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">No children added</h3>
          <p className="text-sm text-gray-400 mb-4">Add your child's details to get started.</p>
          <button onClick={() => setAddOpen(true)} className="btn-primary">Add Your Child</button>
        </div>
      ) : (
        <div className="space-y-4">
          {children.map(child => {
            const subjects = getChildSubjects(child.id);
            const isExpanded = expandedChildId === child.id;

            return (
              <div key={child.id} className={`card transition-all ${selectedChild?.id === child.id ? 'ring-2 ring-blue-500' : ''}`}>
                {/* Child header row */}
                <div className="flex items-start gap-4" onClick={() => selectChild(child)} style={{ cursor: 'pointer' }}>
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-white">{child.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{child.name}</h3>
                      {selectedChild?.id === child.id && (
                        <span className="badge-green text-xs">Active</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-0.5">
                      <GraduationCap className="w-3 h-3" />
                      <span>Class {child.class}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-0.5">
                      <School className="w-3 h-3" />
                      <span className="truncate">{child.school}</span>
                    </div>
                    <p className="text-xs text-gray-400">{child.academicYear}</p>
                  </div>
                  <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setEditChild(child)}
                      className="text-gray-400 hover:text-blue-600 p-1 rounded"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete ${child.name}?`)) deleteChild(child.id); }}
                      className="text-gray-400 hover:text-red-500 p-1 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setExpandedChildId(isExpanded ? null : child.id); }}
                      className="text-gray-400 hover:text-blue-600 p-1 rounded"
                      title={isExpanded ? 'Hide subjects' : 'Manage subjects'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Subject / chapter panel */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-blue-500" /> Subjects &amp; Chapters
                      </p>
                      <button
                        onClick={() => { setAddSubjectForChild(child.id); setNewSubjectName(''); }}
                        className="btn-secondary text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Subject
                      </button>
                    </div>

                    {subjects.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No subjects yet. Add one to start building the curriculum.</p>
                    ) : (
                      <div className="space-y-2">
                        {subjects.map(subject => {
                          const chapters = getSubjectChapters(subject.id);
                          return (
                            <div key={subject.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-semibold text-gray-800">{subject.name}</span>
                                <button
                                  onClick={() => { setAddChapterForSubject({ childId: child.id, subjectId: subject.id, subjectName: subject.name }); setNewChapterName(''); }}
                                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                                >
                                  <Plus className="w-3 h-3" /> Chapter
                                </button>
                              </div>
                              {chapters.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No chapters yet.</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {chapters.map(ch => (
                                    <span key={ch.id} className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-gray-700">{ch.name}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Child form modal */}
      <ChildFormModal
        open={addOpen || !!editChild}
        onClose={() => { setAddOpen(false); setEditChild(null); }}
        existingChild={editChild || undefined}
        onSave={(data) => {
          if (editChild) {
            updateChild(editChild.id, data);
          } else {
            addChild(data);
          }
          setAddOpen(false);
          setEditChild(null);
        }}
      />

      {/* Add Subject modal */}
      <Modal open={!!addSubjectForChild} onClose={() => setAddSubjectForChild(null)} title="Add Subject">
        <div className="space-y-3">
          <div>
            <label className="label">Subject Name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Mathematics"
              value={newSubjectName}
              onChange={e => setNewSubjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setAddSubjectForChild(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleAddSubject} disabled={!newSubjectName.trim() || saving} className="btn-primary flex-1">
              {saving ? 'Adding…' : 'Add Subject'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Chapter modal */}
      <Modal open={!!addChapterForSubject} onClose={() => setAddChapterForSubject(null)} title="Add Chapter">
        <div className="space-y-3">
          {addChapterForSubject && (
            <p className="text-sm text-gray-500">Adding to: <strong>{addChapterForSubject.subjectName}</strong></p>
          )}
          <div>
            <label className="label">Chapter Name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Multiplication"
              value={newChapterName}
              onChange={e => setNewChapterName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddChapter()}
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setAddChapterForSubject(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleAddChapter} disabled={!newChapterName.trim() || saving} className="btn-primary flex-1">
              {saving ? 'Adding…' : 'Add Chapter'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ChildFormModal({
  open, onClose, existingChild, onSave,
}: {
  open: boolean;
  onClose: () => void;
  existingChild?: Child;
  onSave: (data: Omit<Child, 'id' | 'userId'>) => void;
}) {
  const [form, setForm] = useState({
    name: existingChild?.name || '',
    class: existingChild?.class || '3',
    school: existingChild?.school || '',
    academicYear: existingChild?.academicYear || '2024-2025',
  });

  React.useEffect(() => {
    if (existingChild) {
      setForm({ name: existingChild.name, class: existingChild.class, school: existingChild.school, academicYear: existingChild.academicYear });
    } else {
      setForm({ name: '', class: '3', school: '', academicYear: '2024-2025' });
    }
  }, [existingChild, open]);

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Modal open={open} onClose={onClose} title={existingChild ? 'Edit Child' : 'Add Child'}>
      <div className="space-y-4">
        <div>
          <label className="label">Child's Name *</label>
          <input type="text" className="input" placeholder="e.g. Sanju" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Class / Grade *</label>
          <select className="select" value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))}>
            {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">School Name</label>
          <input type="text" className="input" placeholder="e.g. St. Mary's Primary School" value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))} />
        </div>
        <div>
          <label className="label">Academic Year</label>
          <select className="select" value={form.academicYear} onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.name.trim()} className="btn-primary flex-1">
            {existingChild ? 'Save Changes' : 'Add Child'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
