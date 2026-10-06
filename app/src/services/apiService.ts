/**
 * Thin typed wrapper around the REST API.
 * All methods return the parsed JSON or throw on HTTP errors.
 */

// In dev: Vite proxies /api → localhost:3001
// In production (GitHub Pages): VITE_API_URL = https://your-backend.onrender.com
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

// Must match the API_SECRET set on the backend (Render env var).
// Leave blank in dev when the backend is running without API_SECRET.
const API_SECRET = import.meta.env.VITE_API_SECRET ?? '';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (API_SECRET) headers['Authorization'] = `Bearer ${API_SECRET}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Children
  getChildren: () => request<import('../types').Child[]>('GET', '/children'),
  createChild: (data: import('../types').Child) => request<import('../types').Child>('POST', '/children', data),
  updateChild: (id: string, data: Partial<import('../types').Child>) => request<import('../types').Child>('PUT', `/children/${id}`, data),
  deleteChild: (id: string) => request<void>('DELETE', `/children/${id}`),

  // Subjects
  getSubjects: () => request<import('../types').Subject[]>('GET', '/subjects'),
  createSubject: (data: import('../types').Subject) => request<import('../types').Subject>('POST', '/subjects', data),
  updateSubject: (id: string, data: Partial<import('../types').Subject>) => request<import('../types').Subject>('PUT', `/subjects/${id}`, data),
  deleteSubject: (id: string) => request<void>('DELETE', `/subjects/${id}`),

  // Chapters
  getChapters: () => request<import('../types').Chapter[]>('GET', '/chapters'),
  createChapter: (data: import('../types').Chapter) => request<import('../types').Chapter>('POST', '/chapters', data),
  updateChapter: (id: string, data: Partial<import('../types').Chapter>) => request<import('../types').Chapter>('PUT', `/chapters/${id}`, data),
  deleteChapter: (id: string) => request<void>('DELETE', `/chapters/${id}`),

  // Topics
  getTopics: () => request<import('../types').Topic[]>('GET', '/topics'),
  createTopic: (data: import('../types').Topic) => request<import('../types').Topic>('POST', '/topics', data),
  updateTopic: (id: string, data: Partial<import('../types').Topic>) => request<import('../types').Topic>('PUT', `/topics/${id}`, data),
  deleteTopic: (id: string) => request<void>('DELETE', `/topics/${id}`),

  // Exams
  getExams: () => request<import('../types').Exam[]>('GET', '/exams'),
  createExam: (data: import('../types').Exam) => request<import('../types').Exam>('POST', '/exams', data),
  updateExam: (id: string, data: Partial<import('../types').Exam>) => request<import('../types').Exam>('PUT', `/exams/${id}`, data),
  deleteExam: (id: string) => request<void>('DELETE', `/exams/${id}`),

  // Materials
  getMaterials: () => request<import('../types').UploadedMaterial[]>('GET', '/materials'),
  createMaterial: (data: import('../types').UploadedMaterial) => request<import('../types').UploadedMaterial>('POST', '/materials', data),
  updateMaterial: (id: string, data: Partial<import('../types').UploadedMaterial>) => request<import('../types').UploadedMaterial>('PUT', `/materials/${id}`, data),
  deleteMaterial: (id: string) => request<void>('DELETE', `/materials/${id}`),

  // Weekly lessons
  getWeeklyLessons: () => request<import('../types').WeeklyLesson[]>('GET', '/weekly-lessons'),
  createWeeklyLesson: (data: import('../types').WeeklyLesson) => request<import('../types').WeeklyLesson>('POST', '/weekly-lessons', data),
  updateWeeklyLesson: (id: string, data: Partial<import('../types').WeeklyLesson>) => request<import('../types').WeeklyLesson>('PUT', `/weekly-lessons/${id}`, data),
  deleteWeeklyLesson: (id: string) => request<void>('DELETE', `/weekly-lessons/${id}`),

  // Question papers
  getQuestionPapers: () => request<import('../types').GeneratedQuestionPaper[]>('GET', '/question-papers'),
  createQuestionPaper: (data: import('../types').GeneratedQuestionPaper) => request<import('../types').GeneratedQuestionPaper>('POST', '/question-papers', data),
  deleteQuestionPaper: (id: string) => request<void>('DELETE', `/question-papers/${id}`),

  // Practice attempts
  getPracticeAttempts: () => request<import('../types').PracticeAttempt[]>('GET', '/practice-attempts'),
  createPracticeAttempt: (data: import('../types').PracticeAttempt) => request<import('../types').PracticeAttempt>('POST', '/practice-attempts', data),

  // Study plans
  getStudyPlans: () => request<import('../types').StudyPlan[]>('GET', '/study-plans'),
  createStudyPlan: (data: import('../types').StudyPlan) => request<import('../types').StudyPlan>('POST', '/study-plans', data),
  updateStudyPlan: (id: string, data: Partial<import('../types').StudyPlan>) => request<import('../types').StudyPlan>('PUT', `/study-plans/${id}`, data),
  deleteStudyPlan: (id: string) => request<void>('DELETE', `/study-plans/${id}`),
};
