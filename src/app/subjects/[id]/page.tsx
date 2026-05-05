'use client';
import { useEffect, useState, useCallback, use } from 'react';
import { supabase, Question, Subject } from '@/lib/supabase';
import { useUser, useToast } from '@/components/Providers';
import { compressImage } from '@/lib/compress';
import UploadZone, { PreviewFile } from '@/components/UploadZone';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, ChevronRight, Image as ImageIcon, CheckCircle2, Clock, HelpCircle, X, Trash2 } from 'lucide-react';

type Props = { params: Promise<{ id: string }> };

const STATUS_CONFIG = {
  unsolved:    { label: 'Unsolved',    icon: <HelpCircle size={12} />,    cls: 'status-unsolved' },
  in_progress: { label: 'In Progress', icon: <Clock size={12} />,         cls: 'status-in_progress' },
  solved:      { label: 'Solved',      icon: <CheckCircle2 size={12} />,  cls: 'status-solved' },
};

export default function SubjectPage({ params }: Props) {
  const { id } = use(params);
  const { username } = useUser();
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [subRes, qRes] = await Promise.all([
      supabase.from('subjects').select('*').eq('id', id).single(),
      supabase.from('questions').select(`*, question_images(*), solutions(id)`).eq('subject_id', id).order('created_at', { ascending: false }),
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
        uploaded_by_name: username,
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
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <ChevronRight size={14} />
          <span>{subject?.name || '...'}</span>
        </div>

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '2rem' }}>{(subject as any)?.emoji || '📘'}</span>
              {subject?.name || 'Loading...'}
            </h1>
            {subject?.description && <p className="page-subtitle">{subject.description}</p>}
            <div style={{ marginTop: 12, maxWidth: 320 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>{solved} / {questions.length} solved</span>
                <span>{pct}%</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
            </div>
          </div>
          <button className="btn btn-primary" id="add-question-btn" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Upload Doubt
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
          <div className="search-wrap" style={{ maxWidth: 320 }}>
            <Search size={16} className="search-icon" />
            <input className="search-input" placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {['all', 'unsolved', 'in_progress', 'solved'].map((s) => (
            <button
              key={s}
              className={`btn btn-ghost btn-sm ${filter === s ? 'btn-primary' : ''}`}
              onClick={() => setFilter(s)}
              style={filter === s ? {} : {}}
            >
              {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
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
                        <button className="btn btn-danger btn-sm btn-icon" style={{ width: 26, height: 26 }}
                          onClick={(e) => deleteQuestion(q, e)} title="Delete question">
                          <Trash2 size={11} />
                        </button>
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
