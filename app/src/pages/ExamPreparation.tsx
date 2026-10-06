import React, { useState } from 'react';
import { GraduationCap, Plus, Calendar, BookOpen, ChevronRight, Loader, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Modal, ProgressBar, SectionHeader } from '../components/shared/UI';
import { generateExamPlan } from '../services/aiService';
import type { Exam, ExamType, Subject, StudyPlan } from '../types';
import { EXAM_TYPE_LABELS, STUDY_STATUS_LABELS } from '../types';

export function ExamPreparation() {
  const { selectedChild, getChildExams, getChildSubjects, addExam, deleteExam, getExamStudyPlan, saveStudyPlan, deleteStudyPlan } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [visiblePlanExamId, setVisiblePlanExamId] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [loadingExamId, setLoadingExamId] = useState<string | null>(null);

  if (!selectedChild) return <div className="card text-center py-10 text-gray-500">Please select a child first.</div>;

  const exams = getChildExams(selectedChild.id);

  const handleGeneratePlan = async (exam: Exam) => {
    // If a plan already exists for this exam, just show it
    const existing = getExamStudyPlan(exam.id);
    if (existing) {
      setVisiblePlanExamId(exam.id);
      return;
    }
    setPlanLoading(true);
    setLoadingExamId(exam.id);
    setVisiblePlanExamId(null);
    const daysLeft = Math.max(1, Math.ceil((new Date(exam.startDate).getTime() - Date.now()) / 86400000));
    const planLines = await generateExamPlan(exam.name, daysLeft, exam.subjects.map(s => s.subjectName));
    const plan: StudyPlan = {
      id: `sp-${Date.now()}`,
      childId: selectedChild.id,
      examId: exam.id,
      activities: planLines.map((line, i) => ({
        date: '',
        subject: exam.subjects[i % exam.subjects.length]?.subjectName ?? '',
        chapter: '',
        topics: [line],
        type: 'read' as const,
        duration: 30,
        completed: false,
      })),
      status: 'active',
    };
    await saveStudyPlan(plan);
    setVisiblePlanExamId(exam.id);
    setPlanLoading(false);
    setLoadingExamId(null);
  };

  const handleClearPlan = async (examId: string) => {
    const existing = getExamStudyPlan(examId);
    if (existing) await deleteStudyPlan(existing.id);
    setVisiblePlanExamId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Exam
        </button>
      </div>

      {exams.length === 0 ? (
        <div className="card text-center py-12">
          <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">No exams added yet</h3>
          <p className="text-sm text-gray-400 mb-4">Add an upcoming exam to start planning preparation.</p>
          <button onClick={() => setAddOpen(true)} className="btn-primary">Add First Exam</button>
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map(exam => {
            const daysLeft = Math.ceil((new Date(exam.startDate).getTime() - Date.now()) / 86400000);
            const isUrgent = daysLeft <= 7 && daysLeft >= 0;
            return (
              <div key={exam.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-gray-900">{exam.name}</h3>
                      <span className="badge-blue">{EXAM_TYPE_LABELS[exam.examType]}</span>
                      {isUrgent && <span className="badge bg-red-100 text-red-700">⏰ {daysLeft}d left</span>}
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(exam.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {exam.endDate !== exam.startDate && ` – ${new Date(exam.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleGeneratePlan(exam)} className="btn-secondary text-xs flex items-center gap-1" disabled={planLoading}>
                        {planLoading && loadingExamId === exam.id ? <Loader className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
                        {getExamStudyPlan(exam.id) ? 'View Plan' : 'AI Plan'}
                    </button>
                    <button onClick={() => deleteExam(exam.id)} className="text-gray-400 hover:text-red-500 p-1 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subject rows */}
                <div className="space-y-3">
                  {exam.subjects.map(sub => (
                    <div key={sub.subjectId} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm text-gray-900">{sub.subjectName}</span>
                        <span className={`badge text-xs ${
                          sub.revisionStatus === 'completed' ? 'badge-green' :
                          sub.revisionStatus === 'in_progress' ? 'badge-blue' :
                          sub.revisionStatus === 'needs_revision' ? 'badge-yellow' : 'badge-gray'
                        }`}>
                          {STUDY_STATUS_LABELS[sub.revisionStatus]}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2 text-xs text-gray-600">
                        <div><span className="font-medium">{sub.topicsCovered}</span> topics covered</div>
                        <div><span className="font-medium text-green-600">{sub.topicsStudied}</span> studied</div>
                        <div><span className="font-medium text-red-600">{sub.topicsCovered - sub.topicsStudied}</span> pending</div>
                      </div>
                      <ProgressBar value={sub.practiceCompleted} showLabel size="sm" color="bg-green-500" />
                      <p className="text-xs text-gray-400 mt-1">Practice {sub.practiceCompleted}% complete</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Study Plan */}
      {visiblePlanExamId && (() => {
        const plan = getExamStudyPlan(visiblePlanExamId);
        const exam = exams.find(e => e.id === visiblePlanExamId);
        if (!plan || !exam) return null;
        return (
          <div className="card">
            <SectionHeader
              title={`AI Study Plan: ${exam.name}`}
              action={
                <button
                  onClick={() => handleClearPlan(visiblePlanExamId)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  title="Clear saved plan"
                >
                  Clear
                </button>
              }
            />
            <div className="space-y-2">
              {plan.activities.map((activity, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <span className="text-sm text-gray-800">{activity.topics[0] ?? ''}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">* This plan is AI-generated and saved to your account. Click "Clear" to regenerate.</p>
          </div>
        );
      })()}

      <AddExamModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        childId={selectedChild.id}
        existingSubjects={getChildSubjects(selectedChild.id)}
        addExam={addExam}
      />
    </div>
  );
}

// Full list used when the child has no subjects yet
const ALL_SUBJECTS = ['Mathematics', 'English', 'EVS', 'Science', 'Social Studies', 'Hindi', 'Kannada', 'Telugu'];

function AddExamModal({ open, onClose, childId, existingSubjects, addExam }: {
  open: boolean;
  onClose: () => void;
  childId: string;
  existingSubjects: Subject[];
  addExam: (exam: Exam) => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    name: '',
    examType: 'monthly' as ExamType,
    startDate: '',
    endDate: '',
    selectedSubjectIds: [] as string[],
  });

  // Build the list to display: prefer real subjects, fall back to generic names as "virtual" entries
  const subjectOptions: { id: string; name: string }[] =
    existingSubjects.length > 0
      ? existingSubjects
      : ALL_SUBJECTS.map(n => ({ id: `virtual-${n}`, name: n }));

  const toggleSubject = (id: string) => {
    setForm(f => ({
      ...f,
      selectedSubjectIds: f.selectedSubjectIds.includes(id)
        ? f.selectedSubjectIds.filter(s => s !== id)
        : [...f.selectedSubjectIds, id],
    }));
  };

  const handleSubmit = () => {
    if (!form.name || !form.startDate || form.selectedSubjectIds.length === 0) return;
    const exam: Exam = {
      id: `exam-${Date.now()}`,
      childId,
      name: form.name,
      examType: form.examType,
      startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      preparationStatus: 'not_started',
      subjects: form.selectedSubjectIds.map(id => {
        const sub = subjectOptions.find(s => s.id === id)!;
        return {
          subjectId: sub.id,
          subjectName: sub.name,
          chapters: [],
          topicsCovered: 0,
          topicsStudied: 0,
          practiceCompleted: 0,
          revisionStatus: 'not_started',
        };
      }),
    };
    addExam(exam);
    onClose();
    setForm({ name: '', examType: 'monthly', startDate: '', endDate: '', selectedSubjectIds: [] });
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Exam">
      <div className="space-y-4">
        <div>
          <label className="label">Exam Name</label>
          <input type="text" className="input" placeholder="e.g. Monthly Exam – October" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Exam Type</label>
          <select className="select" value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value as ExamType }))}>
            {Object.entries(EXAM_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date</label>
            <input type="date" className="input" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" className="input" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label">Subjects</label>
          <div className="flex flex-wrap gap-2">
            {subjectOptions.map(sub => (
              <button
                key={sub.id}
                onClick={() => toggleSubject(sub.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${form.selectedSubjectIds.includes(sub.id) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} className="btn-primary flex-1" disabled={!form.name || !form.startDate || form.selectedSubjectIds.length === 0}>
            Add Exam
          </button>
        </div>
      </div>
    </Modal>
  );
}
