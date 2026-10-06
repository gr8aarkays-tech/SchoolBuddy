import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Loader, ChevronDown, Sparkles } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { chatWithAssistant } from '../../services/aiService';

// Inline SVG robot avatar — works offline, no external dependency.
function RobotIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="10" y="12" width="16" height="14" rx="3" fill="white" fillOpacity="0.9"/>
      <rect x="13" y="16" width="4" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="19" y="16" width="4" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="16" y="22" width="4" height="2" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="17" y="8" width="2" height="4" rx="1" fill="white" fillOpacity="0.8"/>
      <circle cx="18" cy="7" r="2" fill="white" fillOpacity="0.8"/>
      <rect x="6" y="16" width="3" height="6" rx="1.5" fill="white" fillOpacity="0.7"/>
      <rect x="27" y="16" width="3" height="6" rx="1.5" fill="white" fillOpacity="0.7"/>
      <rect x="13" y="26" width="4" height="4" rx="1.5" fill="white" fillOpacity="0.7"/>
      <rect x="19" y="26" width="4" height="4" rx="1.5" fill="white" fillOpacity="0.7"/>
    </svg>
  );
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

// Page-specific context hints injected as the first assistant message
const PAGE_CONTEXT: Record<string, { greeting: string; suggestions: string[] }> = {
  Dashboard: {
    greeting: `I can see your Dashboard. I can help you understand upcoming exams, topics needing attention, or suggest what to focus on today.`,
    suggestions: ['What should my child study today?', 'Summarize upcoming exams', 'Which topics need attention?'],
  },
  'Upload Materials': {
    greeting: `You're on the Upload page. I can help you understand what material types to choose, how OCR works, or what to do after uploading.`,
    suggestions: ['What material type should I choose?', 'How does AI extract content?', 'What happens after I upload?'],
  },
  'Weekly Plan': {
    greeting: `You're viewing the Weekly Plan. I can help you understand lesson statuses, suggest revision order, or explain topics.`,
    suggestions: ['Which lessons are pending this week?', 'Suggest revision order for this week', 'Explain the topic Fractions'],
  },
  'Exam Preparation': {
    greeting: `You're on Exam Preparation. I can help create a study plan, explain what chapters to prioritize, or estimate readiness.`,
    suggestions: ['Create a 7-day study plan for the monthly exam', 'Which subject needs most attention?', 'How ready is my child for the exam?'],
  },
  'Study Guide': {
    greeting: `You're on the Study Guide. I can explain concepts, generate highlights, create oral questions, or simplify any topic.`,
    suggestions: ['Explain multiplication in simple words', 'What are the most important points for this chapter?', 'Give me 5 oral questions for this topic'],
  },
  'Question Generator': {
    greeting: `You're on the Question Generator. I can help you choose question types, set difficulty, or explain what each question type means.`,
    suggestions: ['What question types are best for Class 3?', 'Explain the difference between short and long answers', 'How many questions should I generate?'],
  },
  'Practice Mode': {
    greeting: `You're in Practice Mode. I can explain incorrect answers, suggest which topics to revise, or generate more practice questions.`,
    suggestions: ['Explain why this answer is wrong', 'Which topics need more practice?', 'Generate 5 more questions on fractions'],
  },
  'Question Library': {
    greeting: `You're in the Question Library. I can help you find the right paper to practice, or suggest new papers to generate.`,
    suggestions: ['Which paper should I attempt first?', 'Generate a new paper on EVS', 'Show papers for Mathematics'],
  },
  Children: {
    greeting: `You're managing Children profiles. I can help you set up a child's subjects, explain academic year settings, or suggest study goals.`,
    suggestions: ['What subjects should I add for Class 3?', 'How do I set up a study goal?', 'What is academic year?'],
  },
  'AI Assistant': {
    greeting: `You're on the AI Assistant page. You can also use me here in this chat widget. What would you like help with?`,
    suggestions: ['What should my child study today?', 'Create a revision plan', 'Explain photosynthesis simply'],
  },
  Settings: {
    greeting: `You're in Settings. I can help you understand AI provider options, explain what each theme does, or guide you through setup.`,
    suggestions: ['What is the difference between AI providers?', 'Which theme is best for reading?', 'How do I connect a real AI provider?'],
  },
};

const DEFAULT_CONTEXT = {
  greeting: `Hello! I'm your AI learning assistant. Ask me anything about your child's studies, upcoming exams, or how to use this app.`,
  suggestions: ['What should my child study today?', 'Summarize upcoming exams', 'Create a 5-day revision plan'],
};

interface FloatingChatProps {
  currentPage: string;
}

export function FloatingChat({ currentPage }: FloatingChatProps) {
  const { selectedChild } = useApp();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const ctx = PAGE_CONTEXT[currentPage] || DEFAULT_CONTEXT;

  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'assistant', text: ctx.greeting },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevPage = useRef(currentPage);

  // Reset chat when page changes — inject new page-context greeting
  useEffect(() => {
    if (prevPage.current !== currentPage) {
      prevPage.current = currentPage;
      const newCtx = PAGE_CONTEXT[currentPage] || DEFAULT_CONTEXT;
      setMessages([{ id: `init-${currentPage}`, role: 'assistant', text: newCtx.greeting }]);
      if (!open) setUnread(1);
    }
  }, [currentPage, open]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setUnread(0);
    }
  }, [open, minimized]);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: msg };
    setMessages(m => [...m, userMsg]);
    setLoading(true);

    try {
      const reply = await chatWithAssistant(
        `[Context: user is on the "${currentPage}" page]\n${msg}`,
        selectedChild?.name || 'your child'
      );
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: reply }]);
      if (!open) setUnread(u => u + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
    setUnread(0);
  };

  return (
    <>
      {/* FAB — always visible */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-5 right-5 z-50 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 overflow-hidden"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          aria-label="Open AI Assistant"
        >
          <RobotIcon size={40} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
              {unread}
            </span>
          )}
          {/* Pulse ring */}
          <span className="absolute w-16 h-16 rounded-full animate-ping opacity-20"
            style={{ backgroundColor: 'var(--color-primary)' }} />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: minimized ? '220px' : '360px',
            height: minimized ? 'auto' : '520px',
            backgroundColor: 'var(--color-card-bg)',
            border: '1px solid var(--color-card-border)',
            maxHeight: '90vh',
            maxWidth: 'calc(100vw - 2.5rem)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          >
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <RobotIcon size={32} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">AI Assistant</p>
              {!minimized && (
                <p className="text-xs text-white/70 truncate">{currentPage}</p>
              )}
            </div>
            <button
              onClick={() => setMinimized(v => !v)}
              className="text-white/70 hover:text-white p-1 rounded"
              title={minimized ? 'Expand' : 'Minimize'}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${minimized ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white p-1 rounded"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                        style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                        <RobotIcon size={22} />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                        msg.role === 'user' ? 'rounded-tr-sm text-white' : 'rounded-tl-sm'
                      }`}
                      style={msg.role === 'user'
                        ? { backgroundColor: 'var(--color-primary)', color: 'white' }
                        : { backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }
                      }
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                      <RobotIcon size={22} />
                    </div>
                    <div className="px-3 py-2 rounded-2xl rounded-tl-sm flex gap-1 items-center"
                      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{ backgroundColor: 'var(--color-text-muted)', animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick suggestions — shown only at start */}
              {messages.length <= 1 && (
                <div className="px-3 pb-2 flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold flex items-center gap-1"
                    style={{ color: 'var(--color-text-muted)' }}>
                    <Sparkles className="w-3 h-3" /> Suggestions for this page
                  </p>
                  {ctx.suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-left text-xs px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: 'var(--color-primary-light)',
                        color: 'var(--color-primary-text)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input bar */}
              <div
                className="flex gap-2 p-2.5 flex-shrink-0"
                style={{ borderTop: '1px solid var(--color-border)' }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                  placeholder="Ask anything…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  disabled={loading}
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-input-border)',
                    color: 'var(--color-text)',
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {loading ? (
                    <Loader className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
