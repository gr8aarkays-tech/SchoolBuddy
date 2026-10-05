// ─── App Settings ─────────────────────────────────────────────────────────────

export type AIProvider = 'mock' | 'openai' | 'anthropic' | 'watsonx' | 'local';

export interface AppSettings {
  aiProvider: AIProvider;
  apiKey: string;
  localModelId: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'mock',
  apiKey: '',
  localModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
};

// ─── Core entities ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Child {
  id: string;
  userId: string;
  name: string;
  class: string;
  school: string;
  academicYear: string;
  avatar?: string;
}

export type MaterialType =
  | 'weekly_lesson_plan'
  | 'monthly_exam_syllabus'
  | 'midterm_exam_syllabus'
  | 'classroom_notes'
  | 'homework'
  | 'worksheet'
  | 'general_study_material'
  | 'other';

export type ProcessingStatus = 'uploaded' | 'processing' | 'processed' | 'requires_review' | 'failed';

export interface UploadedMaterial {
  id: string;
  childId: string;
  fileName: string;
  fileType: 'image' | 'pdf' | 'link';
  fileUrl: string;
  materialType: MaterialType;
  subject: string;
  academicTerm: string;
  examinationType?: string;
  dateReceived: string;
  notes?: string;
  processingStatus: ProcessingStatus;
  extractedText?: string;
  structuredContent?: ExtractedContent;
  uploadedAt: string;
}

export interface ExtractedContent {
  subjects: string[];
  chapters: string[];
  topics: string[];
  definitions: string[];
  importantPoints: string[];
  homework?: string;
  examName?: string;
  confidenceScore: number;
  needsReview: boolean;
}

export interface Subject {
  id: string;
  childId: string;
  name: string;
  color: string;
}

export interface Chapter {
  id: string;
  subjectId: string;
  name: string;
  description?: string;
}

export interface Topic {
  id: string;
  chapterId: string;
  name: string;
  importance: 'high' | 'medium' | 'low';
  studyStatus: StudyStatus;
}

export type StudyStatus = 'not_started' | 'in_progress' | 'needs_revision' | 'completed';

export type ExamType =
  | 'monthly'
  | 'unit_test'
  | 'midterm'
  | 'quarterly'
  | 'half_yearly'
  | 'annual'
  | 'other';

export interface Exam {
  id: string;
  childId: string;
  name: string;
  examType: ExamType;
  startDate: string;
  endDate: string;
  subjects: ExamSubject[];
  preparationStatus: StudyStatus;
}

export interface ExamSubject {
  subjectId: string;
  subjectName: string;
  chapters: string[];
  topicsCovered: number;
  topicsStudied: number;
  practiceCompleted: number;
  revisionStatus: StudyStatus;
}

export type QuestionType =
  | 'mcq'
  | 'fill_blanks'
  | 'true_false'
  | 'one_word'
  | 'short_answer'
  | 'long_answer'
  | 'match_following'
  | 'compare_contrast'
  | 'word_meanings'
  | 'opposites'
  | 'synonyms'
  | 'give_reasons'
  | 'name_following'
  | 'identify_correct'
  | 'rearrange_words'
  | 'grammar'
  | 'math_problems'
  | 'application_based';

export interface QuestionTypeConfig {
  type: QuestionType;
  label: string;
  quantity: number;
  marks: number;
}

export interface QuestionPaperConfig {
  childId: string;
  subject: string;
  sourceChapters: string[];
  difficulty: 'easy' | 'medium' | 'difficult' | 'mixed';
  questionTypes: QuestionTypeConfig[];
  includeAnswers: boolean;
  includeExplanations: boolean;
  includeMarks: boolean;
  randomize: boolean;
  avoidDuplicates: boolean;
  useTextbookTerminology: boolean;
  childFriendlyLanguage: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
  marks: number;
  topic: string;
}

export interface GeneratedQuestionPaper {
  id: string;
  childId: string;
  subjectId: string;
  title: string;
  config: QuestionPaperConfig;
  questions: Question[];
  answerKey: { questionId: string; answer: string; explanation?: string }[];
  createdAt: string;
  totalMarks: number;
}

export interface PracticeAttempt {
  id: string;
  questionPaperId: string;
  childId: string;
  answers: { questionId: string; answer: string; isCorrect?: boolean }[];
  score: number;
  totalMarks: number;
  completedAt: string;
}

export interface WeeklyLesson {
  id: string;
  childId: string;
  day: string;
  date: string;
  subject: string;
  topic: string;
  chapter: string;
  status: StudyStatus;
  homeworkDue?: boolean;
  notes?: string;
}

export interface StudyPlan {
  id: string;
  childId: string;
  examId: string;
  activities: StudyActivity[];
  status: 'active' | 'completed';
}

export interface StudyActivity {
  date: string;
  subject: string;
  chapter: string;
  topics: string[];
  type: 'read' | 'practice' | 'revise' | 'test';
  duration: number;
  completed: boolean;
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export const STUDY_STATUS_LABELS: Record<StudyStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  needs_revision: 'Needs Revision',
  completed: 'Completed',
};

export const STUDY_STATUS_COLORS: Record<StudyStatus, string> = {
  not_started: 'badge-gray',
  in_progress: 'badge-blue',
  needs_revision: 'badge-yellow',
  completed: 'badge-green',
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  weekly_lesson_plan: 'Weekly Lesson Plan',
  monthly_exam_syllabus: 'Monthly Exam Syllabus',
  midterm_exam_syllabus: 'Mid-Term Exam Syllabus',
  classroom_notes: 'Classroom Notes',
  homework: 'Homework',
  worksheet: 'Worksheet',
  general_study_material: 'General Study Material',
  other: 'Other',
};

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  monthly: 'Monthly Exam',
  unit_test: 'Unit Test',
  midterm: 'Mid-Term Exam',
  quarterly: 'Quarterly Exam',
  half_yearly: 'Half-Yearly Exam',
  annual: 'Annual Exam',
  other: 'Other',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple Choice Questions',
  fill_blanks: 'Fill in the Blanks',
  true_false: 'True or False',
  one_word: 'One-Word Answers',
  short_answer: 'Short Answers',
  long_answer: 'Long Answers',
  match_following: 'Match the Following',
  compare_contrast: 'Compare and Contrast',
  word_meanings: 'Word Meanings',
  opposites: 'Opposites',
  synonyms: 'Synonyms',
  give_reasons: 'Give Reasons',
  name_following: 'Name the Following',
  identify_correct: 'Identify the Correct Answer',
  rearrange_words: 'Rearrange the Words',
  grammar: 'Grammar Exercises',
  math_problems: 'Mathematical Problems',
  application_based: 'Application-Based Questions',
};

export const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: 'bg-blue-500',
  English: 'bg-green-500',
  EVS: 'bg-emerald-500',
  Science: 'bg-purple-500',
  'Social Studies': 'bg-orange-500',
  Hindi: 'bg-red-500',
  Kannada: 'bg-yellow-500',
  Telugu: 'bg-pink-500',
};

export function getSubjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] || 'bg-gray-500';
}
