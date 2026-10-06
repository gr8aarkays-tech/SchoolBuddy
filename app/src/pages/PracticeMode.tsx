import React, { useState, useEffect, useRef } from 'react';
import { Dumbbell, ChevronLeft, CheckCircle, XCircle, Trophy, FileQuestion, Plus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import type { Question } from '../types';

export function PracticeMode() {
  const { selectedChild, getChildQuestionPapers, addPracticeAttempt } = useApp();
  const navigate = useNavigate();
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState<string | null>(null);
  // Guard: prevent saving the attempt more than once per submission
  const attemptSaved = useRef(false);

  if (!selectedChild) return <div className="card text-center py-10 text-gray-500">Please select a child first.</div>;

  const papers = getChildQuestionPapers(selectedChild.id);
  const selectedPaper = papers.find(p => p.id === selectedPaperId);

  if (!selectedPaperId || !selectedPaper) {
    return (
      <div className="space-y-4">
        {/* Header row with generator shortcut */}
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {papers.length} paper{papers.length !== 1 ? 's' : ''} available
          </p>
          <button
            onClick={() => navigate('/question-generator')}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Generate New Paper
          </button>
        </div>

        <div className="card">
          <h2 className="section-title">Select a Question Paper</h2>
          {papers.length === 0 ? (
            <div className="text-center py-10">
              <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: 'var(--color-text-muted)' }} />
              <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>No question papers yet</p>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                Use the Question Generator to create a customised practice paper for your child.
              </p>
              <button
                onClick={() => navigate('/question-generator')}
                className="btn-primary flex items-center gap-2 mx-auto"
              >
                <FileQuestion className="w-4 h-4" /> Go to Question Generator
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {papers.map(paper => (
                <div
                  key={paper.id}
                  className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all"
                  style={{
                    border: '1px solid var(--color-card-border)',
                    backgroundColor: 'var(--color-card-bg)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-card-border)')}
                  onClick={() => { setSelectedPaperId(paper.id); setCurrentIdx(0); setAnswers({}); setSubmitted(false); }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-primary-light)' }}>
                    <Dumbbell className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--color-text)' }}>{paper.title}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {paper.questions.length} questions · {paper.totalMarks} marks · {paper.config.difficulty} difficulty
                    </p>
                  </div>
                  <span className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--color-primary)' }}>
                    Start →
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const questions = selectedPaper.questions;
  const currentQ = questions[currentIdx];

  // Normalise an open-text answer before comparison (trim, lowercase, collapse whitespace/punctuation)
  const normalise = (s: string) => s.trim().toLowerCase().replace(/[.,!?;:'"()\-]/g, '').replace(/\s+/g, ' ');

  // Save the practice attempt exactly once when the user submits
  const correct = submitted ? questions.filter(q => normalise(answers[q.id] ?? '') === normalise(q.answer)).length : 0;
  const score = submitted ? questions.reduce((s, q) => s + (normalise(answers[q.id] ?? '') === normalise(q.answer) ? q.marks : 0), 0) : 0;

  useEffect(() => {
    if (!submitted || !selectedPaper || attemptSaved.current) return;
    attemptSaved.current = true;
    addPracticeAttempt({
      id: `pa-${Date.now()}`,
      questionPaperId: selectedPaper.id,
      childId: selectedChild.id,
      answers: questions.map(q => ({ questionId: q.id, answer: answers[q.id] || '', isCorrect: answers[q.id]?.trim().toLowerCase() === q.answer.toLowerCase() })),
      score,
      totalMarks: selectedPaper.totalMarks,
      completedAt: new Date().toISOString(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  if (submitted && selectedPaper) {
    // Results
    const pct = Math.round((score / selectedPaper.totalMarks) * 100);

    // Weak topics
    const wrongTopics = [...new Set(questions.filter(q => normalise(answers[q.id] ?? '') !== normalise(q.answer)).map(q => q.topic))];

    return (
      <div className="space-y-6">
        {/* Score card */}
        <div className={`card text-center py-8 ${pct >= 80 ? 'bg-green-50 border-green-200' : pct >= 60 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
          <Trophy className={`w-12 h-12 mx-auto mb-3 ${pct >= 80 ? 'text-yellow-500' : pct >= 60 ? 'text-blue-500' : 'text-red-400'}`} />
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{score} / {selectedPaper.totalMarks}</h2>
          <p className="text-4xl font-bold mb-2" style={{ color: pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626' }}>{pct}%</p>
          <p className="text-gray-600">{pct >= 80 ? '🎉 Excellent! Keep it up!' : pct >= 60 ? '👍 Good effort! A bit more practice will help.' : '💪 Keep practicing! Review the answers below.'}</p>
          <div className="flex justify-center gap-6 mt-4 text-sm text-gray-600">
            <span className="text-green-600 font-medium">✓ {correct} Correct</span>
            <span className="text-red-600 font-medium">✗ {questions.length - correct} Incorrect</span>
          </div>
        </div>

        {wrongTopics.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Topics Needing More Practice:</h3>
            <div className="flex flex-wrap gap-2">
              {wrongTopics.map(t => <span key={t} className="badge bg-red-100 text-red-700 px-3 py-1">{t}</span>)}
            </div>
            <p className="text-xs text-gray-500 mt-2">Review these topics in your Study Guide and try again.</p>
          </div>
        )}

        {/* Review answers */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Review All Answers</h3>
          <div className="space-y-3">
            {questions.map((q, i) => {
              const isCorrect = normalise(answers[q.id] ?? '') === normalise(q.answer);
              return (
                <div key={q.id} className={`p-3 rounded-xl border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-start gap-2">
                    {isCorrect ? <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{i + 1}. {q.question}</p>
                      {!isCorrect && <p className="text-xs text-red-700 mt-0.5">Your answer: {answers[q.id] || '(no answer)'}</p>}
                      <p className="text-xs text-green-700 font-medium mt-0.5">Correct: {q.answer}</p>
                      {q.explanation && <p className="text-xs text-gray-600 mt-0.5">{q.explanation}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => { setSelectedPaperId(null); setSubmitted(false); attemptSaved.current = false; }} className="btn-secondary flex-1">Back to Papers</button>
          <button onClick={() => { setAnswers({}); setCurrentIdx(0); setSubmitted(false); attemptSaved.current = false; }} className="btn-primary flex-1">Try Again</button>
        </div>
      </div>
    );
  }

  // Question view
  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setSelectedPaperId(null)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-sm text-gray-600 font-medium">{currentIdx + 1} of {questions.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="card">
        <p className="text-xs font-medium text-blue-600 mb-2 uppercase tracking-wide">
          Question {currentIdx + 1} · {currentQ.marks} {currentQ.marks === 1 ? 'mark' : 'marks'} · {currentQ.topic}
        </p>
        <p className="text-base font-semibold text-gray-900 mb-4 leading-relaxed">{currentQ.question}</p>

        {/* MCQ */}
        {currentQ.options && (
          <div className="space-y-2">
            {currentQ.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setAnswers(a => ({ ...a, [currentQ.id]: opt }))}
                className={`w-full text-left p-3 rounded-xl border-2 text-sm transition-all ${answers[currentQ.id] === opt ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}
              >
                <span className="font-medium mr-2">{String.fromCharCode(97 + i)})</span> {opt}
              </button>
            ))}
          </div>
        )}

        {/* Text answer */}
        {!currentQ.options && (
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Type your answer here…"
            value={answers[currentQ.id] || ''}
            onChange={e => setAnswers(a => ({ ...a, [currentQ.id]: e.target.value }))}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0} className="btn-secondary flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        {currentIdx < questions.length - 1 ? (
          <button onClick={() => setCurrentIdx(i => i + 1)} className="btn-primary flex-1">
            Next →
          </button>
        ) : (
          <button
            onClick={() => setSubmitted(true)}
            className="btn-primary flex-1 bg-green-600 hover:bg-green-700"
          >
            Submit Paper ✓
          </button>
        )}
      </div>

      {/* Answer summary dots */}
      <div className="card">
        <p className="text-xs text-gray-500 mb-2">Questions answered:</p>
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(i)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${i === currentIdx ? 'bg-blue-600 text-white' : answers[q.id] ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
