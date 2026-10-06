import React, { useState } from 'react';
import { FileQuestion, Plus, Minus, Loader, Download, ChevronRight, ChevronLeft, Trash2, FileText } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { LoadingSpinner, SectionHeader } from '../components/shared/UI';
import { generateQuestionPaper, generateQuestionsFromText, type TextQuestion } from '../services/aiService';
import type { QuestionPaperConfig, QuestionType, QuestionTypeConfig, GeneratedQuestionPaper, Question } from '../types';
import { QUESTION_TYPE_LABELS } from '../types';

const SUBJECTS = ['Mathematics', 'English', 'EVS', 'Science', 'Social Studies', 'Hindi', 'Kannada', 'Telugu'];
const DEFAULT_QTYPES: QuestionTypeConfig[] = [
  { type: 'mcq', label: 'Multiple Choice Questions', quantity: 5, marks: 1 },
  { type: 'fill_blanks', label: 'Fill in the Blanks', quantity: 5, marks: 1 },
  { type: 'short_answer', label: 'Short Answers', quantity: 3, marks: 2 },
];

const ALL_QTYPES: QuestionType[] = [
  'mcq', 'fill_blanks', 'true_false', 'one_word', 'short_answer', 'long_answer',
  'match_following', 'compare_contrast', 'word_meanings', 'opposites', 'synonyms',
  'give_reasons', 'name_following', 'identify_correct', 'rearrange_words',
  'grammar', 'math_problems', 'application_based',
];

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export function QuestionGenerator() {
  const { selectedChild, getChildSubjects, getSubjectChapters, addQuestionPaper, getChildQuestionPapers, getMaterialsForSubject } = useApp();
  const [step, setStep] = useState<Step>(1);
  const [config, setConfig] = useState<Partial<QuestionPaperConfig>>({
    difficulty: 'mixed',
    questionTypes: [...DEFAULT_QTYPES],
    includeAnswers: true,
    includeExplanations: true,
    includeMarks: true,
    randomize: false,
    avoidDuplicates: true,
    useTextbookTerminology: true,
    childFriendlyLanguage: true,
  });
  const [paperTitle, setPaperTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState<GeneratedQuestionPaper | null>(null);
  const [viewingPaper, setViewingPaper] = useState<GeneratedQuestionPaper | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  if (!selectedChild) return <div className="card text-center py-10 text-gray-500">Please select a child first.</div>;

  const subjects = getChildSubjects(selectedChild.id);
  const selectedSubjectObj = subjects.find(s => s.name === config.subject);
  const chapters = selectedSubjectObj ? getSubjectChapters(selectedSubjectObj.id) : [];
  const questionPapers = getChildQuestionPapers(selectedChild.id);

  const totalQuestions = (config.questionTypes || []).reduce((s, q) => s + q.quantity, 0);
  const totalMarks = (config.questionTypes || []).reduce((s, q) => s + q.quantity * q.marks, 0);

  const updateQType = (type: QuestionType, field: 'quantity' | 'marks', value: number) => {
    setConfig(c => ({
      ...c,
      questionTypes: (c.questionTypes || []).map(q => q.type === type ? { ...q, [field]: Math.max(0, value) } : q),
    }));
  };

  const removeQType = (type: QuestionType) => {
    setConfig(c => ({ ...c, questionTypes: (c.questionTypes || []).filter(q => q.type !== type) }));
  };

  const addQType = (type: QuestionType) => {
    if ((config.questionTypes || []).some(q => q.type === type)) return;
    setConfig(c => ({
      ...c,
      questionTypes: [...(c.questionTypes || []), { type, label: QUESTION_TYPE_LABELS[type], quantity: 5, marks: 1 }],
    }));
  };

  const handleGenerate = async () => {
    if (!config.subject || !config.questionTypes?.length) return;
    setGenerating(true);
    setGeneratedPaper(null);
    try {
      const totalCount = (config.questionTypes || []).reduce((s, q) => s + q.quantity, 0);

      // Use uploaded material text if available — no AI needed
      const mats = getMaterialsForSubject(selectedChild.id, config.subject!);
      let questions: Question[];

      if (mats.length > 0) {
        const combinedText = mats.map(m => m.extractedText || '').join('\n\n');
        const textQuestions = generateQuestionsFromText(combinedText, totalCount);
        let qIdx = 0;
        questions = textQuestions.map((tq): Question => ({
          id: `q-${++qIdx}`,
          type: tq.type === 'fill_blank' ? 'fill_blanks' : tq.type === 'mcq' ? 'mcq' : tq.type === 'true_false' ? 'true_false' : 'short_answer',
          question: tq.question,
          options: tq.options,
          answer: tq.answer,
          marks: tq.marks,
          topic: config.subject!,
        }));
      } else {
        const fullConfig: QuestionPaperConfig = {
          childId: selectedChild.id,
          subject: config.subject!,
          sourceChapters: config.sourceChapters || [],
          difficulty: config.difficulty || 'mixed',
          questionTypes: config.questionTypes || [],
          includeAnswers: config.includeAnswers ?? true,
          includeExplanations: config.includeExplanations ?? true,
          includeMarks: config.includeMarks ?? true,
          randomize: config.randomize ?? false,
          avoidDuplicates: config.avoidDuplicates ?? true,
          useTextbookTerminology: config.useTextbookTerminology ?? true,
          childFriendlyLanguage: config.childFriendlyLanguage ?? true,
        };
        questions = await generateQuestionPaper(fullConfig);
      }

      const autoTitle = `${config.subject} – Practice Paper${mats.length > 0 ? ' (from uploaded material)' : ''}`;
      const paper: GeneratedQuestionPaper = {
        id: `qp-${Date.now()}`,
        childId: selectedChild.id,
        subjectId: selectedSubjectObj?.id || '',
        title: paperTitle.trim() || autoTitle,
        config: {
          childId: selectedChild.id, subject: config.subject!, sourceChapters: config.sourceChapters || [],
          difficulty: config.difficulty || 'mixed', questionTypes: config.questionTypes || [],
          includeAnswers: true, includeExplanations: true, includeMarks: true,
          randomize: false, avoidDuplicates: true, useTextbookTerminology: true, childFriendlyLanguage: true,
        },
        questions,
        answerKey: questions.map(q => ({ questionId: q.id, answer: q.answer, explanation: q.explanation })),
        createdAt: new Date().toISOString(),
        totalMarks: questions.reduce((s, q) => s + q.marks, 0),
      };
      addQuestionPaper(paper);
      setGeneratedPaper(paper);
      setStep(6);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => window.print();

  // Question paper viewer
  if (viewingPaper) {
    return <QuestionPaperView paper={viewingPaper} onBack={() => setViewingPaper(null)} />;
  }

  // Generated paper
  if (step === 6 && generatedPaper) {
    return <QuestionPaperView paper={generatedPaper} onBack={() => { setStep(1); setGeneratedPaper(null); }} isNew />;
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="card">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[1, 2, 3, 4, 5].map(s => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 ${step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {step > s ? '✓ ' : ''}{['Subject', 'Source', 'Difficulty', 'Q Types', 'Options'][s - 1]}
              </div>
              {s < 5 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 1: Subject */}
      {step === 1 && (
        <div className="card">
          <SectionHeader title="Step 1: Select Subject" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SUBJECTS.map(sub => (
              <button
                key={sub}
                onClick={() => setConfig(c => ({ ...c, subject: sub }))}
                className={`p-4 rounded-xl border-2 text-sm font-medium transition-all ${config.subject === sub ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}
              >
                {sub}
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={() => setStep(2)} disabled={!config.subject} className="btn-primary">Next <ChevronRight className="w-4 h-4 inline" /></button>
          </div>
        </div>
      )}

      {/* Step 2: Source material */}
      {step === 2 && (
        <div className="card">
          <SectionHeader title="Step 2: Select Source Material" />
          {chapters.length === 0 ? (
            <p className="text-sm text-gray-500">No chapters found for {config.subject}. All available content will be used.</p>
          ) : (
            <div className="space-y-2">
              <div
                className={`flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer ${!config.sourceChapters?.length ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => setConfig(c => ({ ...c, sourceChapters: [] }))}
              >
                <span className="text-sm font-medium text-gray-700">📚 Entire Syllabus (all chapters)</span>
              </div>
              {chapters.map(ch => (
                <div
                  key={ch.id}
                  className={`flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer ${(config.sourceChapters || []).includes(ch.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => setConfig(c => ({
                    ...c,
                    sourceChapters: (c.sourceChapters || []).includes(ch.id)
                      ? (c.sourceChapters || []).filter(id => id !== ch.id)
                      : [...(c.sourceChapters || []), ch.id],
                  }))}
                >
                  <span className="text-sm text-gray-700">{ch.name}</span>
                  {ch.description && <span className="text-xs text-gray-400">– {ch.description}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
            <button onClick={() => setStep(3)} className="btn-primary flex items-center gap-1">Next <ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Step 3: Difficulty */}
      {step === 3 && (
        <div className="card">
          <SectionHeader title="Step 3: Select Difficulty" />
          <div className="grid grid-cols-2 gap-3">
            {(['easy', 'medium', 'difficult', 'mixed'] as const).map(d => (
              <button
                key={d}
                onClick={() => setConfig(c => ({ ...c, difficulty: d }))}
                className={`p-4 rounded-xl border-2 text-sm font-medium capitalize transition-all ${config.difficulty === d ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}
              >
                {d === 'easy' ? '🟢 ' : d === 'medium' ? '🟡 ' : d === 'difficult' ? '🔴 ' : '🌈 '}{d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(2)} className="btn-secondary flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
            <button onClick={() => setStep(4)} className="btn-primary flex items-center gap-1">Next <ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Step 4: Question types */}
      {step === 4 && (
        <div className="card">
          <SectionHeader title="Step 4: Question Types & Quantities" />

          {/* Current selection */}
          <div className="space-y-2 mb-4">
            {(config.questionTypes || []).map(qt => (
              <div key={qt.type} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="flex-1 text-sm font-medium text-gray-800">{qt.label}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQType(qt.type, 'quantity', qt.quantity - 1)} className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600"><Minus className="w-3 h-3" /></button>
                  <span className="w-8 text-center text-sm font-medium">{qt.quantity}</span>
                  <button onClick={() => updateQType(qt.type, 'quantity', qt.quantity + 1)} className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600"><Plus className="w-3 h-3" /></button>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span>M:</span>
                  <input type="number" min={1} max={10} className="w-10 border border-gray-300 rounded px-1 py-0.5 text-xs text-center" value={qt.marks} onChange={e => updateQType(qt.type, 'marks', Number(e.target.value))} />
                </div>
                <button onClick={() => removeQType(qt.type)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="flex gap-4 text-sm text-gray-600 p-3 bg-blue-50 rounded-lg border border-blue-100 mb-4">
            <span>Total questions: <strong>{totalQuestions}</strong></span>
            <span>Total marks: <strong>{totalMarks}</strong></span>
          </div>

          {/* Add more types */}
          <details className="mb-4">
            <summary className="text-sm font-medium text-blue-600 cursor-pointer mb-2">+ Add more question types</summary>
            <div className="flex flex-wrap gap-2 mt-2">
              {ALL_QTYPES.filter(t => !(config.questionTypes || []).some(q => q.type === t)).map(t => (
                <button key={t} onClick={() => addQType(t)} className="px-3 py-1 text-xs bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700 rounded-lg font-medium transition-colors">
                  + {QUESTION_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </details>

          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="btn-secondary flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
            <button onClick={() => setStep(5)} disabled={totalQuestions === 0} className="btn-primary flex items-center gap-1">Next <ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Step 5: Options */}
      {step === 5 && (
        <div className="card">
          <SectionHeader title="Step 5: Additional Options" />
          <div className="space-y-3">
            <div>
              <label className="label">Paper Title (optional — leave blank for auto)</label>
              <input
                type="text"
                className="input"
                placeholder={`${config.subject || 'Subject'} – Practice Paper`}
                value={paperTitle}
                onChange={e => setPaperTitle(e.target.value)}
              />
            </div>
            {(Object.entries({
              includeAnswers: 'Include answer key',
              includeExplanations: 'Include explanations',
              includeMarks: 'Show marks per question',
              randomize: 'Randomize question order',
              avoidDuplicates: 'Avoid duplicate questions',
              useTextbookTerminology: 'Use textbook terminology',
              childFriendlyLanguage: 'Use child-friendly language',
            }) as [keyof QuestionPaperConfig, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  checked={!!config[key]}
                  onChange={e => setConfig(c => ({ ...c, [key]: e.target.checked }))}
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 mt-4 text-sm">
            <p className="font-medium text-gray-700 mb-1">Paper summary</p>
            <p className="text-gray-600">Subject: <strong>{config.subject}</strong></p>
            <p className="text-gray-600">Difficulty: <strong>{config.difficulty}</strong></p>
            <p className="text-gray-600">Question types: <strong>{(config.questionTypes || []).length}</strong></p>
            <p className="text-gray-600">Total questions: <strong>{totalQuestions}</strong> | Total marks: <strong>{totalMarks}</strong></p>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(4)} className="btn-secondary flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
            <button onClick={handleGenerate} disabled={generating} className="btn-primary flex items-center gap-2 flex-1 justify-center">
              {generating ? <><Loader className="w-4 h-4 animate-spin" /> Generating…</> : <><FileQuestion className="w-4 h-4" /> Generate Question Paper</>}
            </button>
          </div>
        </div>
      )}

      {/* Previous papers */}
      {questionPapers.length > 0 && step === 1 && (
        <div className="card">
          <SectionHeader title="Question Paper Library" />
          <div className="space-y-2">
            {questionPapers.map(paper => (
              <div key={paper.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50">
                <FileQuestion className="w-5 h-5 text-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{paper.title}</p>
                  <p className="text-xs text-gray-500">{paper.questions.length} questions · {paper.totalMarks} marks · {new Date(paper.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <button onClick={() => setViewingPaper(paper)} className="btn-secondary text-xs">View</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionPaperView({ paper, onBack, isNew }: { paper: GeneratedQuestionPaper; onBack: () => void; isNew?: boolean }) {
  const [showAnswers, setShowAnswers] = useState(false);

  // Group by config.questionTypes when available; fall back to grouping by the question's own type
  // (needed for papers generated from uploaded text, which have no pre-defined type config)
  const groupedQuestions = (() => {
    if (paper.config.questionTypes?.length) {
      return paper.config.questionTypes.reduce((acc, qt) => {
        const qs = paper.questions.filter(q => q.type === qt.type);
        if (qs.length > 0) acc.push({ label: qt.label, marks: qt.marks, questions: qs });
        return acc;
      }, [] as { label: string; marks: number; questions: typeof paper.questions }[]);
    }
    // Fallback: derive sections from the questions themselves
    const byType = new Map<string, typeof paper.questions>();
    for (const q of paper.questions) {
      const key = q.type;
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key)!.push(q);
    }
    return Array.from(byType.entries()).map(([type, qs]) => ({
      label: QUESTION_TYPE_LABELS[type as import('../types').QuestionType] ?? type,
      marks: qs[0].marks,
      questions: qs,
    }));
  })();

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex items-center gap-3 print:hidden">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowAnswers(!showAnswers)} className="btn-secondary text-sm">{showAnswers ? 'Hide Answers' : 'Show Answers'}</button>
          <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 text-sm"><Download className="w-4 h-4" /> Print / Export PDF</button>
        </div>
      </div>

      {isNew && (
        <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-green-800 text-sm font-medium flex items-center gap-2 print:hidden">
          ✓ Question paper generated and saved to your library!
        </div>
      )}

      {/* Paper header */}
      <div className="card text-center print:border-b-2 print:border-gray-800 print:rounded-none">
        <h1 className="text-xl font-bold text-gray-900 mb-2">{paper.title}</h1>
        <div className="flex justify-center flex-wrap gap-4 text-sm text-gray-600">
          <span>Total Questions: <strong>{paper.questions.length}</strong></span>
          <span>Total Marks: <strong>{paper.totalMarks}</strong></span>
          <span>Difficulty: <strong className="capitalize">{paper.config.difficulty}</strong></span>
        </div>
        <p className="text-xs text-gray-400 mt-2">Name: _________________________ Date: _____________</p>
      </div>

      {/* Questions */}
      {groupedQuestions.map((section, si) => (
        <div key={si} className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Section {String.fromCharCode(65 + si)}: {section.label}</h2>
            <span className="text-sm text-gray-500">({section.questions.length} × {section.marks} = {section.questions.length * section.marks} marks)</span>
          </div>
          <div className="space-y-4">
            {section.questions.map((q, qi) => (
              <div key={q.id} className="space-y-2">
                <p className="text-sm font-medium text-gray-800">
                  <span className="font-bold">{qi + 1}.</span> {q.question}
                  {paper.config.includeMarks && <span className="text-gray-400 font-normal ml-2">({q.marks} {q.marks === 1 ? 'mark' : 'marks'})</span>}
                </p>
                {q.options && (
                  <div className="grid grid-cols-2 gap-1 pl-4">
                    {q.options.map((opt, oi) => (
                      <span key={oi} className="text-sm text-gray-700">{String.fromCharCode(97 + oi)}) {opt}</span>
                    ))}
                  </div>
                )}
                {showAnswers && (
                  <div className="pl-4 p-2 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs font-semibold text-green-700">Answer: {q.answer}</p>
                    {q.explanation && <p className="text-xs text-gray-600 mt-0.5">{q.explanation}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
