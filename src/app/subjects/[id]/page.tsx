'use client';
import { useEffect, useState, useCallback, use } from 'react';
import { supabase, Question, Subject } from '@/lib/supabase';
import { useUser, useToast } from '@/components/Providers';
import { compressImage } from '@/lib/compress';
import UploadZone, { PreviewFile } from '@/components/UploadZone';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Plus, ChevronRight, Image as ImageIcon, CheckCircle2, Clock, HelpCircle, X, Trash2, Download } from 'lucide-react';
import { generateSubjectPDF } from '@/lib/pdf';

type Props = { params: Promise<{ id: string }> };

const STATUS_CONFIG = {
  unsolved:    { label: 'Unsolved',    icon: <HelpCircle size={12} />,    cls: 'status-unsolved' },
  in_progress: { label: 'In Progress', icon: <Clock size={12} />,         cls: 'status-in_progress' },
  solved:      { label: 'Solved',      icon: <CheckCircle2 size={12} />,  cls: 'status-solved' },
};

export default function SubjectPage({ params }: Props) {
  const { id } = use(params);
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [form, setForm] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState(0);

  const handleDownload = async () => {
    setDownloading(true);
    setDlProgress(0);
    try {
      await generateSubjectPDF(subject?.name || 'Subject', filtered, (p) => setDlProgress(p));
      toast('PDF Downloaded ✓');
    } catch (e: any) {
      toast(e.message || 'Download failed', 'error');
    }
    setDownloading(false);
    setDlProgress(0);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [subRes, qRes] = await Promise.all([
      supabase.from('subjects').select('*').eq('id', id).single(),
      supabase.from('questions').select(`*, question_images(*), solutions(*, solution_images(*))`).eq('subject_id', id).order('created_at', { ascending: false }),
    ]);
    if (subRes.error) { toast('Subject not found', 'error'); router.push('/'); return; }
    setSubject(subRes.data);
    setQuestions(qRes.data || []);
    setLoading(false);
  }, [id, toast, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const uploadQuestion = async () => {
    if (!form.title.trim() && files.length === 0) return;
    setSaving(true);
    try {
      const { data: q, error: qErr } = await supabase.from('questions').insert({
        subject_id: id,
        title: form.title.trim() || 'Untitled Question',
        description: form.description.trim() || null,
        status: 'unsolved',
        uploaded_by_name: user?.username || 'Anonymous',
        author_id: user?.id || null,
      }).select().single();
      if (qErr) throw qErr;

      // Upload images
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = `questions/${q.id}/${i}_${Date.now()}.webp`;
        const { error: upErr } = await supabase.storage.from('doubt-images').upload(path, f.file, { contentType: 'image/webp', upsert: false });
        if (upErr) throw upErr;
        await supabase.from('question_images').insert({ question_id: q.id, storage_path: path, page_order: i });
      }

      toast('Question uploaded ✓');
      setShowModal(false);
      setForm({ title: '', description: '' });
      setFiles([]);
      fetchData();
    } catch (e: any) {
      toast(e.message || 'Upload failed', 'error');
    }
    setSaving(false);
  };

  const deleteQuestion = async (q: Question, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this question and its solution?')) return;
    
    // Robustly remove all images from storage folders directly
    const { data: qFiles } = await supabase.storage.from('doubt-images').list(`questions/${q.id}`);
    if (qFiles && qFiles.length > 0) {
      const paths = qFiles.map((f) => `questions/${q.id}/${f.name}`);
      await supabase.storage.from('doubt-images').remove(paths);
    }

    const solId = (q as any).solutions?.[0]?.id;
    if (solId) {
      const { data: sFiles } = await supabase.storage.from('doubt-images').list(`solutions/${solId}`);
      if (sFiles && sFiles.length > 0) {
        const paths = sFiles.map((f) => `solutions/${solId}/${f.name}`);
        await supabase.storage.from('doubt-images').remove(paths);
      }
    }

    const { error } = await supabase.from('questions').delete().eq('id', q.id);
    if (error) {
      console.error(error);
      toast('Failed to delete question', 'error');
    } else {
      toast('Question deleted');
      fetchData();
    }
  };

  const filtered = questions.filter((q) => {
    const matchSearch = q.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || q.status === filter;
    return matchSearch && matchFilter;
  });

  const getThumb = (q: Question) => {
    const img = q.images?.[0];
    if (!img) return null;
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/doubt-images/${img.storage_path}`;
  };

  const solved = questions.filter((q) => q.status === 'solved').length;
  const pct = questions.length ? Math.round((solved / questions.length) * 100) : 0;

  return (
    <div className="page">
      <div className="container">
        {/* Sticky Header Section */}
        <div className="sticky-controls">
          <div className="breadcrumb">
            <Link href="/">Home</Link>
            <ChevronRight size={14} />
            <span>{subject?.name || '...'}</span>
          </div>

          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.5rem' }}>{(subject as any)?.emoji || '📘'}</span>
                {subject?.name || 'Loading...'}
              </h1>
              <div className="progress-bar" style={{ width: 140, marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            
            {user && (
              <button className="btn btn-primary btn-floating" id="add-question-btn" onClick={() => setShowModal(true)}>
                <Plus size={18} /> <span>Upload Doubt</span>
              </button>
            )}
          </div>

          <div className="filter-bar">
            <div className="search-wrap">
              <Search size={16} className="search-icon" />
              <input className="search-input" placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isAdmin && (
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={handleDownload}
                  disabled={downloading}
                  style={{ gap: 6, padding: '8px 12px', minWidth: 80 }}
                >
                  {downloading ? (
                    <span style={{ fontSize: '0.7rem' }}>{dlProgress}%</span>
                  ) : (
                    <><Download size={14} /> PDF</>
                  )}
                </button>
              )}
              
              <select 
                className="btn btn-ghost btn-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ appearance: 'none', paddingRight: 32, cursor: 'pointer' }}
              >
                <option value="all">All Status</option>
                <option value="unsolved">Unsolved</option>
                <option value="in_progress">In Progress</option>
                <option value="solved">Solved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Questions Grid */}
        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤔</div>
            <div className="empty-title">{search || filter !== 'all' ? 'No matching questions' : 'No doubts uploaded yet'}</div>
            <div className="empty-desc">
              {!search && filter === 'all' && 'Be the first to upload a doubt for this subject!'}
            </div>
          </div>
        ) : (
          <div className="grid-4">
            {filtered.map((q) => {
              const thumb = getThumb(q);
              const imgCount = q.images?.length ?? 0;
              return (
                <div key={q.id} className="question-card" id={`question-${q.id}`} onClick={() => router.push(`/questions/${q.id}`)}>
                  <div className="question-card-thumb">
                    {thumb
                      ? <img src={`${thumb}?width=400`} alt={q.title} loading="lazy" />
                      : <div className="question-card-thumb-placeholder">📷</div>}
                    <span className={`status-badge ${STATUS_CONFIG[q.status].cls}`}>
                      {STATUS_CONFIG[q.status].icon} {STATUS_CONFIG[q.status].label}
                    </span>
                  </div>
                  <div className="question-card-body">
                    <div className="question-card-title">{q.title}</div>
                    <div className="question-card-meta">
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>by {q.uploaded_by_name}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {imgCount > 0 && (
                          <span className="image-count-badge">
                            <ImageIcon size={10} /> {imgCount}
                          </span>
                        )}
                        {(q as any).solutions?.length > 0 && (
                          <span className="image-count-badge" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>✓ sol</span>
                        )}
                        {(isAdmin || (user && (q as any).author_id === user.id)) && (
                          <button className="btn btn-danger btn-sm btn-icon" style={{ width: 26, height: 26 }}
                            onClick={(e) => deleteQuestion(q, e)} title="Delete question">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div className="modal-title">Upload a Doubt</div>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Question Title *</label>
                <input className="form-input" placeholder="Describe your doubt briefly..."
                  value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Additional Notes (optional)</label>
                <textarea className="form-input form-textarea" placeholder="Any extra context about this doubt?"
                  value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Screenshot(s) — Multiple pages allowed</label>
                <UploadZone onFilesChange={setFiles} label="question screenshots" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={uploadQuestion}
                disabled={saving || (!form.title.trim() && files.length === 0)}>
                {saving ? 'Uploading...' : 'Upload Doubt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
