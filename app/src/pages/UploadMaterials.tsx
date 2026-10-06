import React, { useState, useRef } from 'react';
import { Upload, FileText, Link as LinkIcon, X, CheckCircle, AlertCircle, Loader, Eye } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Modal, LoadingSpinner, SectionHeader } from '../components/shared/UI';
import { extractTextFromImage, extractTextFromPdf, extractContentFromUrl, analyzeExtractedText } from '../services/aiService';
import type { UploadedMaterial, MaterialType } from '../types';
import { MATERIAL_TYPE_LABELS } from '../types';

const SUBJECTS = ['Mathematics', 'English', 'EVS', 'Science', 'Social Studies', 'Hindi', 'Kannada', 'Telugu', 'All Subjects', 'Other'];
const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Full Year'];
const EXAM_TYPES = ['Monthly Exam', 'Unit Test', 'Mid-Term', 'Quarterly', 'Half-Yearly', 'Annual', 'N/A'];

type UploadStep = 'select' | 'metadata' | 'processing' | 'done' | 'error';

interface UploadForm {
  subject: string;
  materialType: MaterialType;
  academicTerm: string;
  examinationType: string;
  dateReceived: string;
  notes: string;
}

export function UploadMaterials() {
  const { selectedChild, addMaterial, getChildMaterials, deleteMaterial, upsertSubject, upsertChapter, upsertTopic } = useApp();
  const [step, setStep] = useState<UploadStep>('select');
  const [fileType, setFileType] = useState<'image' | 'pdf' | 'link'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [form, setForm] = useState<UploadForm>({
    subject: 'Mathematics',
    materialType: 'weekly_lesson_plan',
    academicTerm: 'Term 2',
    examinationType: 'N/A',
    dateReceived: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [extractedText, setExtractedText] = useState('');
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState('');
  const [previewMaterial, setPreviewMaterial] = useState<UploadedMaterial | null>(null);
  // Ephemeral blob URL for the just-uploaded file — only valid for the current session.
  // Stored separately so we never persist it to the DB / context state.
  const [sessionBlobUrl, setSessionBlobUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!selectedChild) {
    return <div className="card text-center py-10 text-gray-500">Please select a child first.</div>;
  }

  const materials = getChildMaterials(selectedChild.id);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      setError('Please select a JPG, PNG, WEBP image or a PDF file.');
      return;
    }
    setFileType(isPdf ? 'pdf' : 'image');
    setSelectedFile(file);
    setStep('metadata');
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fakeEvent = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    }
  };

  const handleLinkSubmit = () => {
    if (!linkUrl.trim()) { setError('Please enter a URL'); return; }
    setFileType('link');
    setStep('metadata');
    setError('');
  };

  const handleProcess = async () => {
    setStep('processing');
    setError('');
    try {
      setProcessingStatus('Extracting text…');
      let rawText = '';

      if (fileType === 'image' && selectedFile) {
        rawText = await extractTextFromImage(selectedFile);
      } else if (fileType === 'pdf' && selectedFile) {
        setProcessingStatus('Extracting text from PDF… (scanned pages may take a moment)');
        rawText = await extractTextFromPdf(selectedFile);
      } else if (fileType === 'link') {
        rawText = await extractContentFromUrl(linkUrl);
      }

      setProcessingStatus('Analyzing content with AI…');
      const structured = await analyzeExtractedText(rawText);
      setExtractedText(rawText);

      // Create an in-memory blob URL for same-session preview only — do NOT persist it.
      const blobUrl = fileType !== 'link' && selectedFile ? URL.createObjectURL(selectedFile) : '';
      setSessionBlobUrl(blobUrl);

      const material: UploadedMaterial = {
        id: `mat-${Date.now()}`,
        childId: selectedChild.id,
        fileName: selectedFile?.name || linkUrl || 'web-content',
        fileType,
        // For files: store empty string in DB — blob URLs are tab-session only and
        // would be broken after any reload. Links store their permanent URL.
        fileUrl: fileType === 'link' ? linkUrl : '',
        materialType: form.materialType,
        subject: form.subject,
        academicTerm: form.academicTerm,
        examinationType: form.examinationType !== 'N/A' ? form.examinationType : undefined,
        dateReceived: form.dateReceived,
        notes: form.notes || undefined,
        processingStatus: structured.needsReview ? 'requires_review' : 'processed',
        extractedText: rawText,
        structuredContent: structured,
        uploadedAt: new Date().toISOString(),
      };

      addMaterial(material);

      // ── Bridge: upsert subjects / chapters / topics into the study curriculum ──
      //
      // The form.subject (user-selected) is ALWAYS used as the canonical subject
      // because the user explicitly told us what subject this material belongs to.
      // AI-detected subjects are only used as extras when they're real names and
      // differ from the form value (e.g. a multi-subject syllabus document).
      const knownUnknown = (s: string) => !s || s === 'Unknown';
      const formSubjectId = await upsertSubject(selectedChild.id, form.subject);

      // Also upsert any AI-detected subjects that aren't 'Unknown' and differ from form.subject
      const extraSubjects = structured.subjects.filter(
        s => !knownUnknown(s) && s.toLowerCase() !== form.subject.toLowerCase()
      );
      const subjectIds = [formSubjectId, ...(
        await Promise.all(extraSubjects.map(s => upsertSubject(selectedChild.id, s)))
      )];

      // Attach all detected chapters and topics to every subject above
      for (const subjectId of subjectIds) {
        for (const chapterName of structured.chapters) {
          const chapterId = await upsertChapter(subjectId, chapterName);
          for (const topicName of structured.topics) {
            await upsertTopic(chapterId, topicName);
          }
        }
      }

      setStep('done');
    } catch (err) {
      setError(String(err));
      setStep('error');
    }
  };

  const handleReset = () => {
    setStep('select');
    setSelectedFile(null);
    setLinkUrl('');
    setExtractedText('');
    setProcessingStatus('');
    setError('');
    // Revoke the blob URL to free browser memory
    if (sessionBlobUrl) URL.revokeObjectURL(sessionBlobUrl);
    setSessionBlobUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const statusColors: Record<string, string> = {
    processed: 'text-green-700 bg-green-50 border-green-200',
    requires_review: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    processing: 'text-blue-700 bg-blue-50 border-blue-200',
    uploaded: 'text-gray-700 bg-gray-50 border-gray-200',
    failed: 'text-red-700 bg-red-50 border-red-200',
  };

  const statusLabel: Record<string, string> = {
    processed: 'Processed',
    requires_review: 'Needs Review',
    processing: 'Processing',
    uploaded: 'Uploaded',
    failed: 'Failed',
  };

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div className="card">
        <h2 className="section-title">Upload Learning Materials</h2>

        {step === 'select' && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-2">
              {(['image', 'pdf', 'link'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setFileType(t); setError(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${fileType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {t === 'image' ? '🖼 Image' : t === 'pdf' ? '📄 PDF' : '🔗 Link'}
                </button>
              ))}
            </div>

            {fileType !== 'link' ? (
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-700">Drop your file here or click to browse</p>
                <p className="text-sm text-gray-500 mt-1">
                  {fileType === 'image' ? 'JPG, JPEG, PNG, WEBP up to 20MB' : 'PDF files up to 50MB'}
                </p>
                <p className="text-xs text-gray-400 mt-2">WhatsApp screenshots, lesson plans, exam syllabi, classroom notes</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={fileType === 'image' ? 'image/jpeg,image/png,image/webp' : 'application/pdf'}
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="url"
                  placeholder="https://school.example.com/lesson-plan"
                  className="input"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                />
                <p className="text-xs text-gray-400">School portals, educational websites, Google Drive links</p>
                <button onClick={handleLinkSubmit} className="btn-primary">Continue</button>
              </div>
            )}
            {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
          </div>
        )}

        {step === 'metadata' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{selectedFile?.name || linkUrl}</p>
                <p className="text-xs text-gray-500">{fileType.toUpperCase()}</p>
              </div>
              <button onClick={handleReset} className="ml-auto text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Subject</label>
                <select className="select" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Material Type</label>
                <select className="select" value={form.materialType} onChange={e => setForm(f => ({ ...f, materialType: e.target.value as MaterialType }))}>
                  {Object.entries(MATERIAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Academic Term</label>
                <select className="select" value={form.academicTerm} onChange={e => setForm(f => ({ ...f, academicTerm: e.target.value }))}>
                  {TERMS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Examination Type (if applicable)</label>
                <select className="select" value={form.examinationType} onChange={e => setForm(f => ({ ...f, examinationType: e.target.value }))}>
                  {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Date Received</label>
                <input type="date" className="input" value={form.dateReceived} onChange={e => setForm(f => ({ ...f, dateReceived: e.target.value }))} />
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <input type="text" placeholder="Any additional notes…" className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleReset} className="btn-secondary">Back</button>
              <button onClick={handleProcess} className="btn-primary flex items-center gap-2">
                <Upload className="w-4 h-4" /> Process with AI
              </button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-12">
            <LoadingSpinner size="lg" text={processingStatus || 'Processing your material…'} />
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Material Processed!</h3>
            <p className="text-sm text-gray-500 mb-4">Your material has been uploaded and analyzed by AI.</p>
            {extractedText && (
              <details className="text-left mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <summary className="text-sm font-medium text-gray-700 cursor-pointer">View extracted text</summary>
                <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{extractedText}</pre>
              </details>
            )}
            <button onClick={handleReset} className="btn-primary">Upload Another</button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Processing Failed</h3>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button onClick={handleReset} className="btn-primary">Try Again</button>
          </div>
        )}
      </div>

      {/* Material library */}
      <div className="card">
        <SectionHeader title={`Uploaded Materials (${materials.length})`} />
        {materials.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No materials uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {materials.map(mat => (
              <div key={mat.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${mat.fileType === 'pdf' ? 'bg-red-50' : mat.fileType === 'link' ? 'bg-green-50' : 'bg-blue-50'}`}>
                  <FileText className={`w-5 h-5 ${mat.fileType === 'pdf' ? 'text-red-500' : mat.fileType === 'link' ? 'text-green-500' : 'text-blue-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{mat.fileName}</p>
                  <p className="text-xs text-gray-500">{MATERIAL_TYPE_LABELS[mat.materialType]} · {mat.subject} · {new Date(mat.dateReceived).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[mat.processingStatus]}`}>
                    {statusLabel[mat.processingStatus]}
                  </span>
                  <button onClick={() => setPreviewMaterial(mat)} className="text-gray-400 hover:text-blue-600 p-1 rounded" title="Preview">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteMaterial(mat.id)} className="text-gray-400 hover:text-red-500 p-1 rounded" title="Delete">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      <Modal open={!!previewMaterial} onClose={() => setPreviewMaterial(null)} title="Material Preview" maxWidth="max-w-2xl">
        {previewMaterial && (
          <div className="space-y-4">
            {/* File preview — only available in same browser session for uploaded files */}
            {previewMaterial.fileType === 'image' && sessionBlobUrl && (
              <img src={sessionBlobUrl} alt={previewMaterial.fileName} className="w-full max-h-64 object-contain rounded-lg border border-gray-200 bg-gray-50" />
            )}
            {previewMaterial.fileType === 'link' && previewMaterial.fileUrl && (
              <a href={previewMaterial.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" /> {previewMaterial.fileUrl}
              </a>
            )}
            {previewMaterial.fileType !== 'link' && !sessionBlobUrl && (
              <p className="text-xs text-gray-400 italic">File preview not available after page reload — only extracted text is stored.</p>
            )}
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-500">Subject:</span> <span className="font-medium">{previewMaterial.subject}</span></div>
              <div><span className="text-gray-500">Type:</span> <span className="font-medium">{MATERIAL_TYPE_LABELS[previewMaterial.materialType]}</span></div>
              <div><span className="text-gray-500">Term:</span> <span className="font-medium">{previewMaterial.academicTerm}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{new Date(previewMaterial.dateReceived).toLocaleDateString('en-IN')}</span></div>
            </div>
            {previewMaterial.structuredContent?.needsReview && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">Some information could not be confidently identified. Please review or correct it.</p>
              </div>
            )}
            {previewMaterial.structuredContent && (
              <div className="space-y-3">
                {previewMaterial.structuredContent.subjects.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subjects</p>
                    <div className="flex flex-wrap gap-1">{previewMaterial.structuredContent.subjects.map(s => <span key={s} className="badge-blue">{s}</span>)}</div>
                  </div>
                )}
                {previewMaterial.structuredContent.chapters.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Chapters</p>
                    <div className="flex flex-wrap gap-1">{previewMaterial.structuredContent.chapters.map(c => <span key={c} className="badge-purple">{c}</span>)}</div>
                  </div>
                )}
                {previewMaterial.structuredContent.topics.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Topics</p>
                    <div className="flex flex-wrap gap-1">{previewMaterial.structuredContent.topics.map(t => <span key={t} className="badge-gray">{t}</span>)}</div>
                  </div>
                )}
                {previewMaterial.structuredContent.importantPoints.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Important Points</p>
                    <ul className="list-disc list-inside space-y-1">{previewMaterial.structuredContent.importantPoints.map((p, i) => <li key={i} className="text-sm text-gray-700">{p}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
            {previewMaterial.extractedText && (
              <details>
                <summary className="text-sm font-medium text-gray-600 cursor-pointer">Raw extracted text</summary>
                <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">{previewMaterial.extractedText}</pre>
              </details>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
