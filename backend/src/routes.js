import { Router } from 'express';
import { db } from './db.js';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJSON(val, fallback) {
  try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
}

/** @libsql/client returns Row objects; convert to plain object */
function row(r) { return r ? Object.fromEntries(Object.entries(r)) : null; }

function mapChild(r) {
  return r ? { id: r.id, userId: r.userId, name: r.name, class: r.class, school: r.school, academicYear: r.academicYear, ...(r.avatar ? { avatar: r.avatar } : {}) } : null;
}
function mapSubject(r) { return { id: r.id, childId: r.childId, name: r.name, color: r.color }; }
function mapChapter(r) { return { id: r.id, subjectId: r.subjectId, name: r.name, ...(r.description ? { description: r.description } : {}) }; }
function mapTopic(r) { return { id: r.id, chapterId: r.chapterId, name: r.name, importance: r.importance, studyStatus: r.studyStatus }; }
function mapExam(r) { return { id: r.id, childId: r.childId, name: r.name, examType: r.examType, startDate: r.startDate, endDate: r.endDate, preparationStatus: r.preparationStatus, subjects: parseJSON(r.subjects, []) }; }
function mapMaterial(r) {
  return { id: r.id, childId: r.childId, fileName: r.fileName, fileType: r.fileType, fileUrl: r.fileUrl, materialType: r.materialType, subject: r.subject, academicTerm: r.academicTerm, ...(r.examinationType ? { examinationType: r.examinationType } : {}), dateReceived: r.dateReceived, ...(r.notes ? { notes: r.notes } : {}), processingStatus: r.processingStatus, ...(r.extractedText ? { extractedText: r.extractedText } : {}), ...(r.structuredContent ? { structuredContent: parseJSON(r.structuredContent, undefined) } : {}), uploadedAt: r.uploadedAt };
}
function mapLesson(r) { return { id: r.id, childId: r.childId, day: r.day, date: r.date, subject: r.subject, topic: r.topic, chapter: r.chapter, status: r.status, homeworkDue: r.homeworkDue === 1 || r.homeworkDue === true, ...(r.notes ? { notes: r.notes } : {}) }; }
function mapPaper(r) { return { id: r.id, childId: r.childId, subjectId: r.subjectId, title: r.title, config: parseJSON(r.config, {}), questions: parseJSON(r.questions, []), answerKey: parseJSON(r.answerKey, []), createdAt: r.createdAt, totalMarks: Number(r.totalMarks) }; }
function mapAttempt(r) { return { id: r.id, questionPaperId: r.questionPaperId, childId: r.childId, answers: parseJSON(r.answers, []), score: Number(r.score), totalMarks: Number(r.totalMarks), completedAt: r.completedAt }; }
function mapStudyPlan(r) { return { id: r.id, childId: r.childId, examId: r.examId, activities: parseJSON(r.activities, []), status: r.status }; }

// ─── Children ──────────────────────────────────────────────────────────────────

router.get('/children', async (_, res) => {
  const { rows } = await db.execute('SELECT * FROM children');
  res.json(rows.map(r => mapChild(row(r))));
});

router.post('/children', async (req, res) => {
  const { id, userId, name, class: cls, school, academicYear, avatar } = req.body;
  await db.execute({ sql: `INSERT INTO children (id, userId, name, class, school, academicYear, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)`, args: [id, userId || 'user-1', name, cls, school, academicYear, avatar || null] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM children WHERE id = ?', args: [id] });
  res.status(201).json(mapChild(row(rows[0])));
});

router.put('/children/:id', async (req, res) => {
  const { name, class: cls, school, academicYear, avatar } = req.body;
  await db.execute({ sql: `UPDATE children SET name=?, class=?, school=?, academicYear=?, avatar=? WHERE id=?`, args: [name, cls, school, academicYear, avatar || null, req.params.id] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM children WHERE id = ?', args: [req.params.id] });
  res.json(mapChild(row(rows[0])));
});

router.delete('/children/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM children WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

// ─── Subjects ──────────────────────────────────────────────────────────────────

router.get('/subjects', async (_, res) => {
  const { rows } = await db.execute('SELECT * FROM subjects');
  res.json(rows.map(r => mapSubject(row(r))));
});

router.post('/subjects', async (req, res) => {
  const { id, childId, name, color } = req.body;
  await db.execute({ sql: `INSERT INTO subjects (id, childId, name, color) VALUES (?, ?, ?, ?)`, args: [id, childId, name, color || '#6b7280'] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM subjects WHERE id = ?', args: [id] });
  res.status(201).json(mapSubject(row(rows[0])));
});

router.put('/subjects/:id', async (req, res) => {
  const { name, color } = req.body;
  await db.execute({ sql: `UPDATE subjects SET name=?, color=? WHERE id=?`, args: [name, color, req.params.id] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM subjects WHERE id = ?', args: [req.params.id] });
  res.json(mapSubject(row(rows[0])));
});

router.delete('/subjects/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM subjects WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

// ─── Chapters ──────────────────────────────────────────────────────────────────

router.get('/chapters', async (_, res) => {
  const { rows } = await db.execute('SELECT * FROM chapters');
  res.json(rows.map(r => mapChapter(row(r))));
});

router.post('/chapters', async (req, res) => {
  const { id, subjectId, name, description } = req.body;
  await db.execute({ sql: `INSERT INTO chapters (id, subjectId, name, description) VALUES (?, ?, ?, ?)`, args: [id, subjectId, name, description || null] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM chapters WHERE id = ?', args: [id] });
  res.status(201).json(mapChapter(row(rows[0])));
});

router.put('/chapters/:id', async (req, res) => {
  const { name, description } = req.body;
  await db.execute({ sql: `UPDATE chapters SET name=?, description=? WHERE id=?`, args: [name, description || null, req.params.id] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM chapters WHERE id = ?', args: [req.params.id] });
  res.json(mapChapter(row(rows[0])));
});

router.delete('/chapters/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM chapters WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

// ─── Topics ────────────────────────────────────────────────────────────────────

router.get('/topics', async (_, res) => {
  const { rows } = await db.execute('SELECT * FROM topics');
  res.json(rows.map(r => mapTopic(row(r))));
});

router.post('/topics', async (req, res) => {
  const { id, chapterId, name, importance, studyStatus } = req.body;
  await db.execute({ sql: `INSERT INTO topics (id, chapterId, name, importance, studyStatus) VALUES (?, ?, ?, ?, ?)`, args: [id, chapterId, name, importance || 'medium', studyStatus || 'not_started'] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM topics WHERE id = ?', args: [id] });
  res.status(201).json(mapTopic(row(rows[0])));
});

router.put('/topics/:id', async (req, res) => {
  const { rows: existing } = await db.execute({ sql: 'SELECT * FROM topics WHERE id = ?', args: [req.params.id] });
  if (!existing[0]) return res.status(404).json({ error: 'Not found' });
  const e = row(existing[0]);
  const { name, importance, studyStatus } = req.body;
  await db.execute({ sql: `UPDATE topics SET name=?, importance=?, studyStatus=? WHERE id=?`, args: [name ?? e.name, importance ?? e.importance, studyStatus ?? e.studyStatus, req.params.id] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM topics WHERE id = ?', args: [req.params.id] });
  res.json(mapTopic(row(rows[0])));
});

router.delete('/topics/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM topics WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

// ─── Exams ─────────────────────────────────────────────────────────────────────

router.get('/exams', async (_, res) => {
  const { rows } = await db.execute('SELECT * FROM exams');
  res.json(rows.map(r => mapExam(row(r))));
});

router.post('/exams', async (req, res) => {
  const { id, childId, name, examType, startDate, endDate, preparationStatus, subjects } = req.body;
  await db.execute({ sql: `INSERT INTO exams (id, childId, name, examType, startDate, endDate, preparationStatus, subjects) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, args: [id, childId, name, examType, startDate, endDate, preparationStatus || 'not_started', JSON.stringify(subjects || [])] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM exams WHERE id = ?', args: [id] });
  res.status(201).json(mapExam(row(rows[0])));
});

router.put('/exams/:id', async (req, res) => {
  const { rows: existing } = await db.execute({ sql: 'SELECT * FROM exams WHERE id = ?', args: [req.params.id] });
  if (!existing[0]) return res.status(404).json({ error: 'Not found' });
  const e = row(existing[0]);
  const { name, examType, startDate, endDate, preparationStatus, subjects } = req.body;
  await db.execute({ sql: `UPDATE exams SET name=?, examType=?, startDate=?, endDate=?, preparationStatus=?, subjects=? WHERE id=?`, args: [name ?? e.name, examType ?? e.examType, startDate ?? e.startDate, endDate ?? e.endDate, preparationStatus ?? e.preparationStatus, subjects !== undefined ? JSON.stringify(subjects) : e.subjects, req.params.id] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM exams WHERE id = ?', args: [req.params.id] });
  res.json(mapExam(row(rows[0])));
});

router.delete('/exams/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM exams WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

// ─── Materials ─────────────────────────────────────────────────────────────────

router.get('/materials', async (_, res) => {
  const { rows } = await db.execute('SELECT * FROM materials ORDER BY uploadedAt DESC');
  res.json(rows.map(r => mapMaterial(row(r))));
});

router.post('/materials', async (req, res) => {
  const m = req.body;
  await db.execute({ sql: `INSERT INTO materials (id, childId, fileName, fileType, fileUrl, materialType, subject, academicTerm, examinationType, dateReceived, notes, processingStatus, extractedText, structuredContent, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [m.id, m.childId, m.fileName, m.fileType, m.fileUrl || '', m.materialType, m.subject, m.academicTerm, m.examinationType || null, m.dateReceived, m.notes || null, m.processingStatus || 'uploaded', m.extractedText || null, m.structuredContent ? JSON.stringify(m.structuredContent) : null, m.uploadedAt] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM materials WHERE id = ?', args: [m.id] });
  res.status(201).json(mapMaterial(row(rows[0])));
});

router.put('/materials/:id', async (req, res) => {
  const { rows: existing } = await db.execute({ sql: 'SELECT * FROM materials WHERE id = ?', args: [req.params.id] });
  if (!existing[0]) return res.status(404).json({ error: 'Not found' });
  const e = row(existing[0]);
  const m = req.body;
  await db.execute({ sql: `UPDATE materials SET fileName=?, fileType=?, fileUrl=?, materialType=?, subject=?, academicTerm=?, examinationType=?, dateReceived=?, notes=?, processingStatus=?, extractedText=?, structuredContent=? WHERE id=?`, args: [m.fileName ?? e.fileName, m.fileType ?? e.fileType, m.fileUrl ?? e.fileUrl, m.materialType ?? e.materialType, m.subject ?? e.subject, m.academicTerm ?? e.academicTerm, m.examinationType ?? e.examinationType, m.dateReceived ?? e.dateReceived, m.notes ?? e.notes, m.processingStatus ?? e.processingStatus, m.extractedText ?? e.extractedText, m.structuredContent !== undefined ? JSON.stringify(m.structuredContent) : e.structuredContent, req.params.id] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM materials WHERE id = ?', args: [req.params.id] });
  res.status(200).json(mapMaterial(row(rows[0])));
});

router.delete('/materials/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM materials WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

// ─── Weekly Lessons ────────────────────────────────────────────────────────────

router.get('/weekly-lessons', async (_, res) => {
  const { rows } = await db.execute('SELECT * FROM weekly_lessons');
  res.json(rows.map(r => mapLesson(row(r))));
});

router.post('/weekly-lessons', async (req, res) => {
  const l = req.body;
  await db.execute({ sql: `INSERT INTO weekly_lessons (id, childId, day, date, subject, topic, chapter, status, homeworkDue, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [l.id, l.childId, l.day, l.date, l.subject, l.topic, l.chapter, l.status || 'not_started', l.homeworkDue ? 1 : 0, l.notes || null] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM weekly_lessons WHERE id = ?', args: [l.id] });
  res.status(201).json(mapLesson(row(rows[0])));
});

router.put('/weekly-lessons/:id', async (req, res) => {
  const { rows: existing } = await db.execute({ sql: 'SELECT * FROM weekly_lessons WHERE id = ?', args: [req.params.id] });
  if (!existing[0]) return res.status(404).json({ error: 'Not found' });
  const e = row(existing[0]);
  const l = req.body;
  await db.execute({ sql: `UPDATE weekly_lessons SET day=?, date=?, subject=?, topic=?, chapter=?, status=?, homeworkDue=?, notes=? WHERE id=?`, args: [l.day ?? e.day, l.date ?? e.date, l.subject ?? e.subject, l.topic ?? e.topic, l.chapter ?? e.chapter, l.status ?? e.status, l.homeworkDue !== undefined ? (l.homeworkDue ? 1 : 0) : e.homeworkDue, l.notes ?? e.notes, req.params.id] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM weekly_lessons WHERE id = ?', args: [req.params.id] });
  res.json(mapLesson(row(rows[0])));
});

router.delete('/weekly-lessons/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM weekly_lessons WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

// ─── Question Papers ───────────────────────────────────────────────────────────

router.get('/question-papers', async (_, res) => {
  const { rows } = await db.execute('SELECT * FROM question_papers ORDER BY createdAt DESC');
  res.json(rows.map(r => mapPaper(row(r))));
});

router.post('/question-papers', async (req, res) => {
  const p = req.body;
  await db.execute({ sql: `INSERT INTO question_papers (id, childId, subjectId, title, config, questions, answerKey, createdAt, totalMarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [p.id, p.childId, p.subjectId, p.title, JSON.stringify(p.config || {}), JSON.stringify(p.questions || []), JSON.stringify(p.answerKey || []), p.createdAt, p.totalMarks || 0] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM question_papers WHERE id = ?', args: [p.id] });
  res.status(201).json(mapPaper(row(rows[0])));
});

router.delete('/question-papers/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM question_papers WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

// ─── Practice Attempts ─────────────────────────────────────────────────────────

router.get('/practice-attempts', async (_, res) => {
  const { rows } = await db.execute('SELECT * FROM practice_attempts');
  res.json(rows.map(r => mapAttempt(row(r))));
});

router.post('/practice-attempts', async (req, res) => {
  const a = req.body;
  await db.execute({ sql: `INSERT INTO practice_attempts (id, questionPaperId, childId, answers, score, totalMarks, completedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`, args: [a.id, a.questionPaperId, a.childId, JSON.stringify(a.answers || []), a.score || 0, a.totalMarks || 0, a.completedAt] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM practice_attempts WHERE id = ?', args: [a.id] });
  res.status(201).json(mapAttempt(row(rows[0])));
});

// ─── Study Plans ───────────────────────────────────────────────────────────────

router.get('/study-plans', async (_, res) => {
  const { rows } = await db.execute('SELECT * FROM study_plans');
  res.json(rows.map(r => mapStudyPlan(row(r))));
});

router.post('/study-plans', async (req, res) => {
  const p = req.body;
  await db.execute({ sql: `INSERT INTO study_plans (id, childId, examId, activities, status) VALUES (?, ?, ?, ?, ?)`, args: [p.id, p.childId, p.examId, JSON.stringify(p.activities || []), p.status || 'active'] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM study_plans WHERE id = ?', args: [p.id] });
  res.status(201).json(mapStudyPlan(row(rows[0])));
});

router.put('/study-plans/:id', async (req, res) => {
  const { rows: existing } = await db.execute({ sql: 'SELECT * FROM study_plans WHERE id = ?', args: [req.params.id] });
  if (!existing[0]) return res.status(404).json({ error: 'Not found' });
  const e = row(existing[0]);
  const p = req.body;
  await db.execute({ sql: `UPDATE study_plans SET activities=?, status=? WHERE id=?`, args: [p.activities !== undefined ? JSON.stringify(p.activities) : e.activities, p.status ?? e.status, req.params.id] });
  const { rows } = await db.execute({ sql: 'SELECT * FROM study_plans WHERE id = ?', args: [req.params.id] });
  res.json(mapStudyPlan(row(rows[0])));
});

router.delete('/study-plans/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM study_plans WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

export default router;
