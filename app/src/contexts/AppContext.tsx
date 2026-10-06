import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type {
  Child,
  Subject,
  Chapter,
  Topic,
  Exam,
  UploadedMaterial,
  WeeklyLesson,
  GeneratedQuestionPaper,
  PracticeAttempt,
  StudyPlan,
} from '../types';
// WeeklyLesson re-exported so it is available as a value (not just type) when needed
import { SUBJECT_COLORS } from '../types';
import { useAuth, DEMO_USER_ID } from './AuthContext';
import { api } from '../services/apiService';
import {
  mockChildren,
  mockSubjects,
  mockChapters,
  mockTopics,
  mockExams,
  mockMaterials,
  mockWeeklyLessons,
  mockQuestionPaper,
  mockPracticeAttempts,
} from '../data/mockData';

interface AppState {
  loading: boolean;
  children: Child[];
  selectedChild: Child | null;
  subjects: Subject[];
  chapters: Chapter[];
  topics: Topic[];
  exams: Exam[];
  materials: UploadedMaterial[];
  weeklyLessons: WeeklyLesson[];
  questionPapers: GeneratedQuestionPaper[];
  practiceAttempts: PracticeAttempt[];
  studyPlans: StudyPlan[];
}

interface AppContextValue extends AppState {
  selectChild: (child: Child) => void;
  addChild: (child: Omit<Child, 'id' | 'userId'>) => Promise<void>;
  updateChild: (id: string, updates: Partial<Child>) => Promise<void>;
  deleteChild: (id: string) => Promise<void>;
  addMaterial: (material: UploadedMaterial) => Promise<void>;
  updateMaterial: (id: string, updates: Partial<UploadedMaterial>) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
  addQuestionPaper: (paper: GeneratedQuestionPaper) => Promise<void>;
  deleteQuestionPaper: (id: string) => Promise<void>;
  addExam: (exam: Exam) => Promise<void>;
  updateExam: (id: string, updates: Partial<Exam>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  updateTopic: (id: string, updates: Partial<Topic>) => Promise<void>;
  addPracticeAttempt: (attempt: PracticeAttempt) => Promise<void>;
  addWeeklyLesson: (lesson: WeeklyLesson) => Promise<void>;
  updateWeeklyLesson: (id: string, updates: Partial<WeeklyLesson>) => Promise<void>;
  /** Upsert a subject for a child — creates it if it doesn't exist yet, returns its id */
  upsertSubject: (childId: string, name: string) => Promise<string>;
  /** Upsert a chapter under a subject — creates it if it doesn't exist yet, returns its id */
  upsertChapter: (subjectId: string, name: string) => Promise<string>;
  /** Upsert a topic under a chapter — creates it if it doesn't exist yet */
  upsertTopic: (chapterId: string, name: string) => Promise<void>;
  getChildSubjects: (childId: string) => Subject[];
  getSubjectChapters: (subjectId: string) => Chapter[];
  getChapterTopics: (chapterId: string) => Topic[];
  getChildExams: (childId: string) => Exam[];
  getChildMaterials: (childId: string) => UploadedMaterial[];
  getMaterialsForSubject: (childId: string, subject: string) => UploadedMaterial[];
  getChildWeeklyLessons: (childId: string) => WeeklyLesson[];
  getChildQuestionPapers: (childId: string) => GeneratedQuestionPaper[];
  getExamStudyPlan: (examId: string) => StudyPlan | undefined;
  saveStudyPlan: (plan: StudyPlan) => Promise<void>;
  deleteStudyPlan: (id: string) => Promise<void>;
  // Kept for backwards compatibility
  currentUser: { id: string; name: string; email: string };
}

const AppContext = createContext<AppContextValue | null>(null);

const EMPTY_STATE: AppState = {
  loading: false,
  children: [],
  selectedChild: null,
  subjects: [],
  chapters: [],
  topics: [],
  exams: [],
  materials: [],
  weeklyLessons: [],
  questionPapers: [],
  practiceAttempts: [],
  studyPlans: [],
};

export function AppProvider({ children: reactChildren }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>({ ...EMPTY_STATE, loading: true });

  // ─── Load data when user changes ──────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setState({ ...EMPTY_STATE });
      return;
    }

    // Demo user gets mock data instantly (no backend call)
    if (user.id === DEMO_USER_ID) {
      setState({
        loading: false,
        children: mockChildren,
        selectedChild: mockChildren[0],
        subjects: mockSubjects,
        chapters: mockChapters,
        topics: mockTopics,
        exams: mockExams,
        materials: mockMaterials,
        weeklyLessons: mockWeeklyLessons,
        questionPapers: [mockQuestionPaper],
        practiceAttempts: mockPracticeAttempts,
        studyPlans: [],
      });
      return;
    }

    // Real user: load from backend DB
    setState(s => ({ ...s, loading: true }));
    Promise.all([
      api.getChildren(),
      api.getSubjects(),
      api.getChapters(),
      api.getTopics(),
      api.getExams(),
      api.getMaterials(),
      api.getWeeklyLessons(),
      api.getQuestionPapers(),
      api.getPracticeAttempts(),
      api.getStudyPlans(),
    ]).then(([children, subjects, chapters, topics, exams, materials, weeklyLessons, questionPapers, practiceAttempts, studyPlans]) => {
      setState({
        loading: false,
        children,
        selectedChild: children[0] ?? null,
        subjects,
        chapters,
        topics,
        exams,
        materials,
        weeklyLessons,
        questionPapers,
        practiceAttempts,
        studyPlans,
      });
    }).catch(err => {
      console.error('Failed to load data from API:', err);
      setState(s => ({ ...s, loading: false }));
    });
  }, [user?.id]);

  const isDemo = user?.id === DEMO_USER_ID;

  // ─── Actions — demo users mutate in-memory, real users call API ───────────

  const selectChild = useCallback((child: Child) => {
    setState(s => ({ ...s, selectedChild: child }));
  }, []);

  const addChild = useCallback(async (childData: Omit<Child, 'id' | 'userId'>) => {
    const newChild: Child = { ...childData, id: `child-${Date.now()}`, userId: user?.id ?? 'unknown' };
    if (isDemo) {
      setState(s => ({ ...s, children: [...s.children, newChild], selectedChild: s.selectedChild || newChild }));
    } else {
      const saved = await api.createChild(newChild);
      setState(s => ({ ...s, children: [...s.children, saved], selectedChild: s.selectedChild || saved }));
    }
  }, [user?.id, isDemo]);

  const updateChild = useCallback(async (id: string, updates: Partial<Child>) => {
    if (isDemo) {
      setState(s => ({
        ...s,
        children: s.children.map(c => c.id === id ? { ...c, ...updates } : c),
        selectedChild: s.selectedChild?.id === id ? { ...s.selectedChild, ...updates } : s.selectedChild,
      }));
    } else {
      const saved = await api.updateChild(id, updates);
      setState(s => ({
        ...s,
        children: s.children.map(c => c.id === id ? saved : c),
        selectedChild: s.selectedChild?.id === id ? saved : s.selectedChild,
      }));
    }
  }, [isDemo]);

  const deleteChild = useCallback(async (id: string) => {
    if (!isDemo) await api.deleteChild(id);
    setState(s => ({
      ...s,
      children: s.children.filter(c => c.id !== id),
      selectedChild: s.selectedChild?.id === id ? (s.children.find(c => c.id !== id) ?? null) : s.selectedChild,
    }));
  }, [isDemo]);

  const addMaterial = useCallback(async (material: UploadedMaterial) => {
    if (isDemo) {
      setState(s => ({ ...s, materials: [material, ...s.materials] }));
    } else {
      const saved = await api.createMaterial(material);
      setState(s => ({ ...s, materials: [saved, ...s.materials] }));
    }
  }, [isDemo]);

  const updateMaterial = useCallback(async (id: string, updates: Partial<UploadedMaterial>) => {
    if (isDemo) {
      setState(s => ({ ...s, materials: s.materials.map(m => m.id === id ? { ...m, ...updates } : m) }));
    } else {
      const saved = await api.updateMaterial(id, updates);
      setState(s => ({ ...s, materials: s.materials.map(m => m.id === id ? saved : m) }));
    }
  }, [isDemo]);

  const deleteMaterial = useCallback(async (id: string) => {
    if (!isDemo) await api.deleteMaterial(id);
    setState(s => ({ ...s, materials: s.materials.filter(m => m.id !== id) }));
  }, [isDemo]);

  const addQuestionPaper = useCallback(async (paper: GeneratedQuestionPaper) => {
    if (isDemo) {
      setState(s => ({ ...s, questionPapers: [paper, ...s.questionPapers] }));
    } else {
      const saved = await api.createQuestionPaper(paper);
      setState(s => ({ ...s, questionPapers: [saved, ...s.questionPapers] }));
    }
  }, [isDemo]);

  const deleteQuestionPaper = useCallback(async (id: string) => {
    if (!isDemo) await api.deleteQuestionPaper(id);
    setState(s => ({ ...s, questionPapers: s.questionPapers.filter(p => p.id !== id) }));
  }, [isDemo]);

  const addWeeklyLesson = useCallback(async (lesson: WeeklyLesson) => {
    if (isDemo) {
      setState(s => ({ ...s, weeklyLessons: [...s.weeklyLessons, lesson] }));
    } else {
      const saved = await api.createWeeklyLesson(lesson);
      setState(s => ({ ...s, weeklyLessons: [...s.weeklyLessons, saved] }));
    }
  }, [isDemo]);

  const updateWeeklyLesson = useCallback(async (id: string, updates: Partial<WeeklyLesson>) => {
    if (isDemo) {
      setState(s => ({ ...s, weeklyLessons: s.weeklyLessons.map(l => l.id === id ? { ...l, ...updates } : l) }));
    } else {
      const saved = await api.updateWeeklyLesson(id, updates);
      setState(s => ({ ...s, weeklyLessons: s.weeklyLessons.map(l => l.id === id ? saved : l) }));
    }
  }, [isDemo]);

  const addExam = useCallback(async (exam: Exam) => {
    if (isDemo) {
      setState(s => ({ ...s, exams: [...s.exams, exam] }));
    } else {
      const saved = await api.createExam(exam);
      setState(s => ({ ...s, exams: [...s.exams, saved] }));
    }
  }, [isDemo]);

  const updateExam = useCallback(async (id: string, updates: Partial<Exam>) => {
    if (isDemo) {
      setState(s => ({ ...s, exams: s.exams.map(e => e.id === id ? { ...e, ...updates } : e) }));
    } else {
      const saved = await api.updateExam(id, updates);
      setState(s => ({ ...s, exams: s.exams.map(e => e.id === id ? saved : e) }));
    }
  }, [isDemo]);

  const deleteExam = useCallback(async (id: string) => {
    if (!isDemo) await api.deleteExam(id);
    setState(s => ({ ...s, exams: s.exams.filter(e => e.id !== id) }));
  }, [isDemo]);

  const updateTopic = useCallback(async (id: string, updates: Partial<Topic>) => {
    if (isDemo) {
      setState(s => ({ ...s, topics: s.topics.map(t => t.id === id ? { ...t, ...updates } : t) }));
    } else {
      const saved = await api.updateTopic(id, updates);
      setState(s => ({ ...s, topics: s.topics.map(t => t.id === id ? saved : t) }));
    }
  }, [isDemo]);

  const addPracticeAttempt = useCallback(async (attempt: PracticeAttempt) => {
    if (isDemo) {
      setState(s => ({ ...s, practiceAttempts: [...s.practiceAttempts, attempt] }));
    } else {
      const saved = await api.createPracticeAttempt(attempt);
      setState(s => ({ ...s, practiceAttempts: [...s.practiceAttempts, saved] }));
    }
  }, [isDemo]);

  // ─── Upsert helpers — used after material processing to seed the curriculum ─

  const upsertSubject = useCallback(async (childId: string, name: string): Promise<string> => {
    // Read current state snapshot synchronously before any await
    let existing: Subject | undefined;
    let resultId = '';
    setState(s => {
      existing = s.subjects.find(
        sub => sub.childId === childId && sub.name.toLowerCase() === name.toLowerCase(),
      );
      return s; // no mutation yet
    });
    if (existing) return existing.id;

    const newSubject: Subject = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      childId,
      name,
      color: SUBJECT_COLORS[name] || 'bg-gray-500',
    };

    if (!isDemo) {
      const saved = await api.createSubject(newSubject);
      resultId = saved.id;
      setState(s => ({ ...s, subjects: [...s.subjects, saved] }));
    } else {
      resultId = newSubject.id;
      setState(s => ({ ...s, subjects: [...s.subjects, newSubject] }));
    }
    return resultId;
  }, [isDemo]);

  const upsertChapter = useCallback(async (subjectId: string, name: string): Promise<string> => {
    let existing: Chapter | undefined;
    let resultId = '';
    setState(s => {
      existing = s.chapters.find(
        ch => ch.subjectId === subjectId && ch.name.toLowerCase() === name.toLowerCase(),
      );
      return s;
    });
    if (existing) return existing.id;

    const newChapter: Chapter = {
      id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      subjectId,
      name,
    };

    if (!isDemo) {
      const saved = await api.createChapter(newChapter);
      resultId = saved.id;
      setState(s => ({ ...s, chapters: [...s.chapters, saved] }));
    } else {
      resultId = newChapter.id;
      setState(s => ({ ...s, chapters: [...s.chapters, newChapter] }));
    }
    return resultId;
  }, [isDemo]);

  const upsertTopic = useCallback(async (chapterId: string, name: string): Promise<void> => {
    let existing: Topic | undefined;
    setState(s => {
      existing = s.topics.find(
        t => t.chapterId === chapterId && t.name.toLowerCase() === name.toLowerCase(),
      );
      return s;
    });
    if (existing) return;

    const newTopic: Topic = {
      id: `top-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      chapterId,
      name,
      importance: 'medium',
      studyStatus: 'not_started',
    };

    if (!isDemo) {
      const saved = await api.createTopic(newTopic);
      setState(s => ({ ...s, topics: [...s.topics, saved] }));
    } else {
      setState(s => ({ ...s, topics: [...s.topics, newTopic] }));
    }
  }, [isDemo]);

  // ─── Study Plans ──────────────────────────────────────────────────────────

  const saveStudyPlan = useCallback(async (plan: StudyPlan) => {
    const exists = state.studyPlans.some(p => p.id === plan.id);
    if (isDemo) {
      setState(s => ({
        ...s,
        studyPlans: exists
          ? s.studyPlans.map(p => p.id === plan.id ? plan : p)
          : [...s.studyPlans, plan],
      }));
    } else if (exists) {
      const saved = await api.updateStudyPlan(plan.id, { activities: plan.activities, status: plan.status });
      setState(s => ({ ...s, studyPlans: s.studyPlans.map(p => p.id === plan.id ? saved : p) }));
    } else {
      const saved = await api.createStudyPlan(plan);
      setState(s => ({ ...s, studyPlans: [...s.studyPlans, saved] }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, state.studyPlans]);

  const deleteStudyPlan = useCallback(async (id: string) => {
    if (!isDemo) await api.deleteStudyPlan(id);
    setState(s => ({ ...s, studyPlans: s.studyPlans.filter(p => p.id !== id) }));
  }, [isDemo]);

  // ─── Derived getters ──────────────────────────────────────────────────────

  const getChildSubjects = useCallback((childId: string) => state.subjects.filter(s => s.childId === childId), [state.subjects]);
  const getSubjectChapters = useCallback((subjectId: string) => state.chapters.filter(c => c.subjectId === subjectId), [state.chapters]);
  const getChapterTopics = useCallback((chapterId: string) => state.topics.filter(t => t.chapterId === chapterId), [state.topics]);
  const getChildExams = useCallback((childId: string) => state.exams.filter(e => e.childId === childId), [state.exams]);
  const getChildMaterials = useCallback((childId: string) => state.materials.filter(m => m.childId === childId), [state.materials]);
  const getMaterialsForSubject = useCallback((childId: string, subject: string) =>
    state.materials.filter(m => m.childId === childId && m.extractedText &&
      (m.subject.toLowerCase() === subject.toLowerCase() || m.subject === 'All Subjects')),
  [state.materials]);
  const getChildWeeklyLessons = useCallback((childId: string) => state.weeklyLessons.filter(l => l.childId === childId), [state.weeklyLessons]);
  const getChildQuestionPapers = useCallback((childId: string) => state.questionPapers.filter(p => p.childId === childId), [state.questionPapers]);
  const getExamStudyPlan = useCallback((examId: string) => state.studyPlans.find(p => p.examId === examId), [state.studyPlans]);

  const value: AppContextValue = {
    ...state,
    currentUser: { id: user?.id ?? '', name: user?.name ?? '', email: user?.email ?? '' },
    selectChild, addChild, updateChild, deleteChild,
    addMaterial, updateMaterial, deleteMaterial,
    addQuestionPaper, deleteQuestionPaper, addExam, updateExam, deleteExam,
    updateTopic, addPracticeAttempt,
    addWeeklyLesson, updateWeeklyLesson,
    upsertSubject, upsertChapter, upsertTopic,
    getChildSubjects, getSubjectChapters, getChapterTopics,
    getChildExams, getChildMaterials, getMaterialsForSubject, getChildWeeklyLessons, getChildQuestionPapers,
    getExamStudyPlan, saveStudyPlan, deleteStudyPlan,
  };

  return <AppContext.Provider value={value}>{reactChildren}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
