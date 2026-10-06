import React, { useState } from 'react';
import { FileQuestion as FileQ, Plus, Dumbbell, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { QUESTION_TYPE_LABELS } from '../types';

// Subject emoji map — makes cards fun for kids
const SUBJECT_EMOJI: Record<string, string> = {
  Mathematics: '🔢', English: '📖', EVS: '🌿', Science: '🔬',
  'Social Studies': '🌍', Hindi: '🇮🇳', Kannada: '🌸', Telugu: '🌺',
};

const DIFFICULTY_EMOJI: Record<string, string> = {
  easy: '🟢 Easy', medium: '🟡 Medium', difficult: '🔴 Hard', mixed: '🌈 Mixed',
};

export function QuestionLibrary() {
  const { selectedChild, getChildQuestionPapers, deleteQuestionPaper } = useApp();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!selectedChild) {
    return (
      <div className="card text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
        👧 Please select a child first.
      </div>
    );
  }

  const papers = getChildQuestionPapers(selectedChild.id);

  return (
    <div className="space-y-4">
      {/* Header row — same pattern as Practice Mode */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          📚 {papers.length} paper{papers.length !== 1 ? 's' : ''} saved
        </p>
        <button
          onClick={() => navigate('/question-generator')}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Generate New Paper
        </button>
      </div>

      {papers.length === 0 ? (
        <div className="card text-center py-14">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="font-semibold text-lg mb-1" style={{ color: 'var(--color-text)' }}>
            No question papers yet!
          </h3>
          <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
            Create a customised practice paper for {selectedChild.name} in just a few clicks. 🚀
          </p>
          <button
            onClick={() => navigate('/question-generator')}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <FileQ className="w-4 h-4" /> Go to Question Generator
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {papers.map(paper => {
            const subjectEmoji = SUBJECT_EMOJI[paper.config.subject] || '📄';
            const isExpanded = expandedId === paper.id;
            const totalQ = paper.questions.length;

            return (
              <div
                key={paper.id}
                className="card"
                style={{ border: '1px solid var(--color-card-border)' }}
              >
                {/* Paper header */}
                <div className="flex items-start gap-3">
                  {/* Subject icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-primary-light)' }}
                  >
                    {subjectEmoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                      {paper.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {totalQ} questions · {paper.totalMarks} marks
                      </span>
                      <span className="badge-blue text-xs">
                        {DIFFICULTY_EMOJI[paper.config.difficulty] || paper.config.difficulty}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        🗓 {new Date(paper.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate('/practice')}
                      className="btn-primary text-xs flex items-center gap-1"
                    >
                      <Dumbbell className="w-3 h-3" /> Practice
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : paper.id)}
                      className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--color-text-muted)' }}
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => { if (window.confirm(`Delete "${paper.title}"?`)) deleteQuestionPaper(paper.id); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete paper"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expandable question-type breakdown */}
                {isExpanded && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
                      📋 Question Breakdown
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {paper.config.questionTypes.map(qt => (
                        <span
                          key={qt.type}
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{
                            backgroundColor: 'var(--color-primary-light)',
                            color: 'var(--color-primary-text)',
                          }}
                        >
                          {qt.label} × {qt.quantity} ({qt.quantity * qt.marks}m)
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => navigate('/question-generator')}
                        className="btn-secondary text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Generate Similar
                      </button>
                      <button
                        onClick={() => navigate('/practice')}
                        className="btn-primary text-xs flex items-center gap-1"
                      >
                        <Dumbbell className="w-3 h-3" /> Start Practice
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
