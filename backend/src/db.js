import { createClient } from '@libsql/client';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Database connection ──────────────────────────────────────────────────────
//
// Priority order:
//   1. TURSO_DB_URL + TURSO_DB_TOKEN  → Turso cloud (persistent, survives redeploys)
//   2. Local file fallback            → used in development when env vars are absent
//
// To set up Turso:
//   1. Sign up free at https://turso.tech
//   2. turso db create schoolbuddy
//   3. turso db show schoolbuddy --url   → copy as TURSO_DB_URL
//   4. turso db tokens create schoolbuddy → copy as TURSO_DB_TOKEN
//   5. Add both to Render env vars (or .env for local dev)

const TURSO_URL   = process.env.TURSO_DB_URL;
const TURSO_TOKEN = process.env.TURSO_DB_TOKEN;

let db_config;
if (TURSO_URL) {
  // Cloud mode — persistent Turso database
  db_config = { url: TURSO_URL, authToken: TURSO_TOKEN };
  console.log('DB: Turso cloud →', TURSO_URL);
} else {
  // Local fallback — SQLite file on disk
  const DATA_DIR = process.env.DATA_DIR ?? join(__dirname, '..', 'data');
  const DB_PATH  = join(DATA_DIR, 'sanjuclass1.db');
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  db_config = { url: `file:${DB_PATH}` };
  console.log('DB: local file →', DB_PATH);
}

export const db = createClient(db_config);

// ─── Schema ──────────────────────────────────────────────────────────────────

await db.executeMultiple(`
  CREATE TABLE IF NOT EXISTS children (
    id          TEXT PRIMARY KEY,
    userId      TEXT NOT NULL DEFAULT 'user-1',
    name        TEXT NOT NULL,
    class       TEXT NOT NULL,
    school      TEXT NOT NULL,
    academicYear TEXT NOT NULL,
    avatar      TEXT
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id       TEXT PRIMARY KEY,
    childId  TEXT NOT NULL,
    name     TEXT NOT NULL,
    color    TEXT NOT NULL DEFAULT '#6b7280'
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id          TEXT PRIMARY KEY,
    subjectId   TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS topics (
    id          TEXT PRIMARY KEY,
    chapterId   TEXT NOT NULL,
    name        TEXT NOT NULL,
    importance  TEXT NOT NULL DEFAULT 'medium',
    studyStatus TEXT NOT NULL DEFAULT 'not_started'
  );

  CREATE TABLE IF NOT EXISTS exams (
    id                TEXT PRIMARY KEY,
    childId           TEXT NOT NULL,
    name              TEXT NOT NULL,
    examType          TEXT NOT NULL,
    startDate         TEXT NOT NULL,
    endDate           TEXT NOT NULL,
    preparationStatus TEXT NOT NULL DEFAULT 'not_started',
    subjects          TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS materials (
    id               TEXT PRIMARY KEY,
    childId          TEXT NOT NULL,
    fileName         TEXT NOT NULL,
    fileType         TEXT NOT NULL,
    fileUrl          TEXT NOT NULL DEFAULT '',
    materialType     TEXT NOT NULL,
    subject          TEXT NOT NULL,
    academicTerm     TEXT NOT NULL,
    examinationType  TEXT,
    dateReceived     TEXT NOT NULL,
    notes            TEXT,
    processingStatus TEXT NOT NULL DEFAULT 'uploaded',
    extractedText    TEXT,
    structuredContent TEXT,
    uploadedAt       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weekly_lessons (
    id          TEXT PRIMARY KEY,
    childId     TEXT NOT NULL,
    day         TEXT NOT NULL,
    date        TEXT NOT NULL,
    subject     TEXT NOT NULL,
    topic       TEXT NOT NULL,
    chapter     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'not_started',
    homeworkDue INTEGER NOT NULL DEFAULT 0,
    notes       TEXT
  );

  CREATE TABLE IF NOT EXISTS question_papers (
    id         TEXT PRIMARY KEY,
    childId    TEXT NOT NULL,
    subjectId  TEXT NOT NULL,
    title      TEXT NOT NULL,
    config     TEXT NOT NULL DEFAULT '{}',
    questions  TEXT NOT NULL DEFAULT '[]',
    answerKey  TEXT NOT NULL DEFAULT '[]',
    createdAt  TEXT NOT NULL,
    totalMarks INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS practice_attempts (
    id              TEXT PRIMARY KEY,
    questionPaperId TEXT NOT NULL,
    childId         TEXT NOT NULL,
    answers         TEXT NOT NULL DEFAULT '[]',
    score           INTEGER NOT NULL DEFAULT 0,
    totalMarks      INTEGER NOT NULL DEFAULT 0,
    completedAt     TEXT NOT NULL
  );
`);

// ─── Seed data (only if tables are empty) ────────────────────────────────────

const { rows } = await db.execute('SELECT COUNT(*) as n FROM children');
const count = Number(rows[0].n);

if (count === 0) {
  console.log('Seeding database...');

  // Children
  await db.batch([
    { sql: `INSERT INTO children (id, userId, name, class, school, academicYear) VALUES (?, ?, ?, ?, ?, ?)`, args: ['child-1', 'user-1', 'Sanju', '3', "St. Mary's Primary School", '2024-2025'] },
    { sql: `INSERT INTO children (id, userId, name, class, school, academicYear) VALUES (?, ?, ?, ?, ?, ?)`, args: ['child-2', 'user-1', 'Priya', '5', "St. Mary's Primary School", '2024-2025'] },
  ], 'write');

  // Subjects
  await db.batch([
    { sql: `INSERT INTO subjects VALUES (?, ?, ?, ?)`, args: ['sub-1', 'child-1', 'Mathematics', '#3b82f6'] },
    { sql: `INSERT INTO subjects VALUES (?, ?, ?, ?)`, args: ['sub-2', 'child-1', 'English', '#10b981'] },
    { sql: `INSERT INTO subjects VALUES (?, ?, ?, ?)`, args: ['sub-3', 'child-1', 'EVS', '#8b5cf6'] },
    { sql: `INSERT INTO subjects VALUES (?, ?, ?, ?)`, args: ['sub-4', 'child-1', 'Hindi', '#ef4444'] },
    { sql: `INSERT INTO subjects VALUES (?, ?, ?, ?)`, args: ['sub-5', 'child-2', 'Mathematics', '#3b82f6'] },
    { sql: `INSERT INTO subjects VALUES (?, ?, ?, ?)`, args: ['sub-6', 'child-2', 'English', '#10b981'] },
    { sql: `INSERT INTO subjects VALUES (?, ?, ?, ?)`, args: ['sub-7', 'child-2', 'Science', '#8b5cf6'] },
    { sql: `INSERT INTO subjects VALUES (?, ?, ?, ?)`, args: ['sub-8', 'child-2', 'Social Studies', '#f59e0b'] },
  ], 'write');

  // Chapters
  await db.batch([
    { sql: `INSERT INTO chapters VALUES (?, ?, ?, ?)`, args: ['ch-1', 'sub-1', 'Multiplication', 'Multiplication tables and problems'] },
    { sql: `INSERT INTO chapters VALUES (?, ?, ?, ?)`, args: ['ch-2', 'sub-1', 'Division', 'Basic division concepts'] },
    { sql: `INSERT INTO chapters VALUES (?, ?, ?, ?)`, args: ['ch-3', 'sub-1', 'Fractions', 'Introduction to fractions'] },
    { sql: `INSERT INTO chapters VALUES (?, ?, ?, ?)`, args: ['ch-4', 'sub-2', 'Nouns', 'Types and uses of nouns'] },
    { sql: `INSERT INTO chapters VALUES (?, ?, ?, ?)`, args: ['ch-5', 'sub-2', 'Verbs', 'Action and being verbs'] },
    { sql: `INSERT INTO chapters VALUES (?, ?, ?, ?)`, args: ['ch-6', 'sub-2', 'Adjectives', 'Describing words'] },
    { sql: `INSERT INTO chapters VALUES (?, ?, ?, ?)`, args: ['ch-7', 'sub-3', 'Plants Around Us', 'Parts and types of plants'] },
    { sql: `INSERT INTO chapters VALUES (?, ?, ?, ?)`, args: ['ch-8', 'sub-3', 'Animals', 'Types and habitats of animals'] },
    { sql: `INSERT INTO chapters VALUES (?, ?, ?, ?)`, args: ['ch-9', 'sub-4', 'पाठ 1 – मेरा परिवार', 'Family and relationships'] },
  ], 'write');

  // Topics
  await db.batch([
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-1', 'ch-1', '2× to 5× tables', 'high', 'completed'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-2', 'ch-1', '6× to 10× tables', 'high', 'in_progress'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-3', 'ch-1', 'Word problems', 'medium', 'not_started'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-4', 'ch-2', 'Division as sharing', 'high', 'not_started'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-5', 'ch-2', 'Division tables', 'high', 'not_started'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-6', 'ch-3', 'What is a fraction?', 'high', 'in_progress'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-7', 'ch-3', 'Numerator and denominator', 'high', 'needs_revision'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-8', 'ch-4', 'Common nouns', 'high', 'completed'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-9', 'ch-4', 'Proper nouns', 'high', 'completed'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-10', 'ch-4', 'Collective nouns', 'medium', 'needs_revision'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-11', 'ch-7', 'Parts of a plant', 'high', 'in_progress'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-12', 'ch-7', 'Functions of roots, stems, leaves', 'high', 'not_started'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-13', 'ch-7', 'Types of plants', 'medium', 'not_started'] },
    { sql: `INSERT INTO topics VALUES (?, ?, ?, ?, ?)`, args: ['t-14', 'ch-7', 'Uses of plants', 'medium', 'not_started'] },
  ], 'write');

  // Exams
  const exam1Subjects = JSON.stringify([
    { subjectId: 'sub-1', subjectName: 'Mathematics', chapters: ['ch-1', 'ch-2'], topicsCovered: 5, topicsStudied: 3, practiceCompleted: 60, revisionStatus: 'in_progress' },
    { subjectId: 'sub-2', subjectName: 'English', chapters: ['ch-4', 'ch-5'], topicsCovered: 6, topicsStudied: 4, practiceCompleted: 45, revisionStatus: 'in_progress' },
    { subjectId: 'sub-3', subjectName: 'EVS', chapters: ['ch-7'], topicsCovered: 4, topicsStudied: 1, practiceCompleted: 20, revisionStatus: 'not_started' },
  ]);
  const exam2Subjects = JSON.stringify([
    { subjectId: 'sub-1', subjectName: 'Mathematics', chapters: ['ch-1', 'ch-2', 'ch-3'], topicsCovered: 8, topicsStudied: 0, practiceCompleted: 0, revisionStatus: 'not_started' },
  ]);
  await db.batch([
    { sql: `INSERT INTO exams VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, args: ['exam-1', 'child-1', 'Monthly Examination – October', 'monthly', '2024-10-28', '2024-11-01', 'in_progress', exam1Subjects] },
    { sql: `INSERT INTO exams VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, args: ['exam-2', 'child-1', 'Mid-Term Examination', 'midterm', '2024-11-18', '2024-11-22', 'not_started', exam2Subjects] },
  ], 'write');

  // Materials
  const sc1 = JSON.stringify({ subjects: ['Mathematics'], chapters: ['Multiplication'], topics: ['2× tables', '3× tables', '4× tables', '5× tables', 'Word problems'], definitions: [], importantPoints: ['Practice worksheet page 45 due Friday'], homework: 'Practice worksheet page 45', confidenceScore: 0.92, needsReview: false });
  const sc2 = JSON.stringify({ subjects: ['Mathematics', 'English', 'EVS'], chapters: ['Multiplication', 'Division', 'Nouns', 'Verbs', 'Adjectives', 'Plants Around Us'], topics: ['Times tables', 'Division concepts', 'Types of nouns', 'Action verbs', 'Describing words', 'Parts of a plant'], definitions: [], importantPoints: ['Exam starts October 28', 'Bring geometry box for Maths'], examName: 'Monthly Examination – October 2024', confidenceScore: 0.97, needsReview: false });
  const sc3 = JSON.stringify({ subjects: ['EVS'], chapters: ['Plants Around Us'], topics: ['Parts of a plant', 'Functions of roots', 'Functions of stem', 'Photosynthesis'], definitions: ['Photosynthesis: the process by which plants make their own food using sunlight'], importantPoints: ['All 6 parts of a plant must be memorized', 'Know the function of each part'], confidenceScore: 0.75, needsReview: true });
  const matSql = `INSERT INTO materials (id, childId, fileName, fileType, fileUrl, materialType, subject, academicTerm, examinationType, dateReceived, notes, processingStatus, extractedText, structuredContent, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  await db.batch([
    { sql: matSql, args: ['mat-1', 'child-1', 'lesson_plan_week42.jpg', 'image', '', 'weekly_lesson_plan', 'Mathematics', 'Term 2', null, '2024-10-14', null, 'processed', 'Week 42 Lesson Plan\nMathematics: Chapter 2 – Multiplication', sc1, '2024-10-14T09:30:00Z'] },
    { sql: matSql, args: ['mat-2', 'child-1', 'monthly_exam_syllabus_oct.pdf', 'pdf', '', 'monthly_exam_syllabus', 'All Subjects', 'Term 2', 'Monthly Exam', '2024-10-10', null, 'processed', 'Monthly Examination – October 2024', sc2, '2024-10-10T14:00:00Z'] },
    { sql: matSql, args: ['mat-3', 'child-1', 'classroom_screenshot_evs.png', 'image', '', 'classroom_notes', 'EVS', 'Term 2', null, '2024-10-15', null, 'requires_review', 'Plants Around Us\nParts of a plant: Root, Stem, Leaf, Flower, Fruit, Seed', sc3, '2024-10-15T18:45:00Z'] },
  ], 'write');

  // Weekly lessons
  const wlSql = `INSERT INTO weekly_lessons (id, childId, day, date, subject, topic, chapter, status, homeworkDue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  await db.batch([
    { sql: wlSql, args: ['wl-1', 'child-1', 'Monday', '2024-10-21', 'English', 'Nouns', 'Nouns', 'completed', 0] },
    { sql: wlSql, args: ['wl-2', 'child-1', 'Monday', '2024-10-21', 'Mathematics', '6× table', 'Multiplication', 'completed', 0] },
    { sql: wlSql, args: ['wl-3', 'child-1', 'Tuesday', '2024-10-22', 'Mathematics', 'Fractions intro', 'Fractions', 'needs_revision', 0] },
    { sql: wlSql, args: ['wl-4', 'child-1', 'Tuesday', '2024-10-22', 'EVS', 'Parts of a plant', 'Plants Around Us', 'in_progress', 0] },
    { sql: wlSql, args: ['wl-5', 'child-1', 'Wednesday', '2024-10-23', 'EVS', 'Functions of roots and stem', 'Plants Around Us', 'not_started', 0] },
    { sql: wlSql, args: ['wl-6', 'child-1', 'Wednesday', '2024-10-23', 'Hindi', 'मेरा परिवार', 'पाठ 1', 'not_started', 0] },
    { sql: wlSql, args: ['wl-7', 'child-1', 'Thursday', '2024-10-24', 'English', 'Collective Nouns', 'Nouns', 'not_started', 1] },
    { sql: wlSql, args: ['wl-8', 'child-1', 'Friday', '2024-10-25', 'Mathematics', 'Division as sharing', 'Division', 'not_started', 0] },
  ], 'write');

  // Question paper
  const config = JSON.stringify({ childId: 'child-1', subject: 'Mathematics', sourceChapters: ['ch-1', 'ch-2'], difficulty: 'mixed', questionTypes: [{ type: 'mcq', quantity: 5, marks: 1 }, { type: 'fill_blanks', quantity: 5, marks: 1 }, { type: 'short_answer', quantity: 3, marks: 2 }], includeAnswers: true, includeExplanations: true, includeMarks: true, randomize: false, avoidDuplicates: true, useTextbookTerminology: true, childFriendlyLanguage: true });
  const questions = JSON.stringify([
    { id: 'q-1', type: 'mcq', question: 'What is 6 × 4?', options: ['20', '24', '26', '28'], answer: '24', explanation: '6 × 4 = 24', marks: 1, topic: 'Multiplication' },
    { id: 'q-2', type: 'mcq', question: 'What is 7 × 3?', options: ['18', '21', '24', '27'], answer: '21', explanation: '7 × 3 = 21', marks: 1, topic: 'Multiplication' },
    { id: 'q-3', type: 'mcq', question: 'Which is the product of 9 × 5?', options: ['40', '42', '45', '50'], answer: '45', explanation: '9 × 5 = 45', marks: 1, topic: 'Multiplication' },
    { id: 'q-4', type: 'mcq', question: 'What is 20 ÷ 4?', options: ['4', '5', '6', '8'], answer: '5', explanation: '20 ÷ 4 = 5', marks: 1, topic: 'Division' },
    { id: 'q-5', type: 'mcq', question: 'What is 36 ÷ 6?', options: ['4', '5', '6', '7'], answer: '6', explanation: '36 ÷ 6 = 6', marks: 1, topic: 'Division' },
    { id: 'q-6', type: 'fill_blanks', question: '8 × ___ = 40', answer: '5', marks: 1, topic: 'Multiplication' },
    { id: 'q-7', type: 'fill_blanks', question: '6 × 7 = ___', answer: '42', marks: 1, topic: 'Multiplication' },
    { id: 'q-8', type: 'fill_blanks', question: '24 ÷ 3 = ___', answer: '8', marks: 1, topic: 'Division' },
    { id: 'q-9', type: 'fill_blanks', question: '5 × ___ = 35', answer: '7', marks: 1, topic: 'Multiplication' },
    { id: 'q-10', type: 'fill_blanks', question: '45 ÷ ___ = 9', answer: '5', marks: 1, topic: 'Division' },
    { id: 'q-11', type: 'short_answer', question: 'Explain multiplication using repeated addition.', answer: '4 × 3 = 4 + 4 + 4 = 12', marks: 2, topic: 'Multiplication' },
    { id: 'q-12', type: 'short_answer', question: 'A bag has 6 chocolates. How many in 5 bags?', answer: '5 × 6 = 30', marks: 2, topic: 'Multiplication' },
    { id: 'q-13', type: 'short_answer', question: 'Divide 28 apples among 7 children.', answer: '28 ÷ 7 = 4 each', marks: 2, topic: 'Division' },
  ]);
  await db.execute({ sql: `INSERT INTO question_papers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: ['qp-1', 'child-1', 'sub-1', 'Mathematics – Monthly Examination Practice', config, questions, '[]', '2024-10-16T10:00:00Z', 16] });

  // Practice attempt
  const answers = JSON.stringify([
    { questionId: 'q-1', answer: '24', isCorrect: true },
    { questionId: 'q-2', answer: '21', isCorrect: true },
    { questionId: 'q-3', answer: '40', isCorrect: false },
    { questionId: 'q-4', answer: '5', isCorrect: true },
    { questionId: 'q-5', answer: '6', isCorrect: true },
  ]);
  await db.execute({ sql: `INSERT INTO practice_attempts VALUES (?, ?, ?, ?, ?, ?, ?)`, args: ['pa-1', 'qp-1', 'child-1', answers, 12, 16, '2024-10-17T15:30:00Z'] });

  console.log('Database seeded successfully.');
}
