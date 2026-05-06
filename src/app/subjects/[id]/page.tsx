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
import QuestionCard from '@/components/QuestionCard';

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [inputSearch, setInputSearch] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  
  const [showModal, setShowModal] = useState(false);
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [form, setForm] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState(0);

  const PAGE_SIZE = 12;

  const fetchQuestions = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
      setPage(0);
    } else {
      setLoadingMore(true);
    }

    const currentPage = isInitial ? 0 : page + 1;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('questions')
      .select(`*, question_images(*), solutions(*, solution_images(*))`)
      .eq('subject_id', id)
      .order('created_at', { ascending: sortBy === 'oldest' });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    if (search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    const { data, error } = await query.range(from, to);

    if (error) {
      toast('Failed to load questions', 'error');
    } else {
      if (isInitial) {
        setQuestions(data || []);
      } else {
        setQuestions(prev => [...prev, ...(data || [])]);
      }
      setHasMore(data?.length === PAGE_SIZE);
      if (!isInitial) setPage(currentPage);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [id, filter, sortBy, search, page, toast]);

  // Initial fetch for subject info
  useEffect(() => {
    supabase.from('subjects').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setSubject(data);
    });
  }, [id]);

  // Fetch questions when filter/sort/search changes
  useEffect(() => {
    if (inputSearch === '') {
      setSearch('');
    }
  }, [inputSearch]);

  useEffect(() => {
    // Re-fetch only when the APPLIED search or filters change
    fetchQuestions(true);
  }, [filter, sortBy, search]); 

  const handleDownload = async () => {
    setDownloading(true);
    setDlProgress(0);
    try {
      // For download, we still need to fetch ALL currently filtered questions
      // but we do it separately to not affect the UI list
      let query = supabase
        .from('questions')
        .select(`*, question_images(*), solutions(*, solution_images(*))`)
        .eq('subject_id', id)
        .order('created_at', { ascending: sortBy === 'oldest' });
      if (filter !== 'all') query = query.eq('status', filter);
      if (search.trim()) query = query.ilike('title', `%${search.trim()}%`);
      
      const { data } = await query;
      await generateSubjectPDF(subject?.name || 'Subject', data || [], (p) => setDlProgress(p));
      toast('PDF Downloaded ✓');
    } catch (e: any) {
      toast(e.message || 'Download failed', 'error');
    }
    setDownloading(false);
    setDlProgress(0);
  };

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

      await Promise.all(files.map(async (f, i) => {
        const path = `questions/${q.id}/${i}_${Date.now()}.webp`;
        const { error: upErr } = await supabase.storage.from('doubt-images').upload(path, f.file, { contentType: 'image/webp', upsert: false });
        if (upErr) throw upErr;
        await supabase.from('question_images').insert({ question_id: q.id, storage_path: path, page_order: i });
      }));

      toast('Question uploaded ✓');
      setShowModal(false);
      setForm({ title: '', description: '' });
      setFiles([]);
      fetchQuestions(true); // Reset to page 0
    } catch (e: any) {
      toast(e.message || 'Upload failed', 'error');
    }
    setSaving(false);
  };

  const deleteQuestion = async (q: Question, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this question and its solution?')) return;
    
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
      toast('Failed to delete question', 'error');
    } else {
      setQuestions(prev => prev.filter(item => item.id !== q.id));
      toast('Question deleted');
    }
  };

  // We can't calculate exact progress easily with pagination, 
  // but we can show it based on loaded items or just hide it
  const solvedCount = questions.filter(q => q.status === 'solved').length;
  const pct = questions.length ? Math.round((solvedCount / questions.length) * 100) : 0;

  return (
    <div className="page">
      <div className="container">
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
              {questions.length > 0 && (
                <div className="progress-bar" style={{ width: 140, marginTop: 8 }}>
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
            
            {user && (
              <button className="btn btn-primary btn-floating" id="add-question-btn" onClick={() => setShowModal(true)}>
                <Plus size={18} /> <span>Upload Doubt</span>
              </button>
            )}
          </div>

          <div className="filter-bar">
            <div className="search-wrap">
              <Search 
                size={16} 
                className="search-icon" 
                style={{ cursor: 'pointer' }} 
                onClick={() => setSearch(inputSearch)}
              />
              <input 
                className="search-input" 
                placeholder="Search and press Enter..." 
                value={inputSearch} 
                onChange={(e) => setInputSearch(e.target.value)} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSearch(inputSearch);
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isAdmin && (
                <button className="btn btn-ghost btn-sm" onClick={handleDownload} disabled={downloading} style={{ gap: 6, padding: '8px 12px', minWidth: 80 }}>
                  {downloading ? <span style={{ fontSize: '0.7rem' }}>{dlProgress}%</span> : <><Download size={14} /> PDF</>}
                </button>
              )}
              
              <select className="btn btn-ghost btn-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>

              <select className="btn btn-ghost btn-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="unsolved">Unsolved</option>
                <option value="in_progress">In Progress</option>
                <option value="solved">Solved</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : questions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤔</div>
            <div className="empty-title">{search || filter !== 'all' ? 'No matching questions' : 'No doubts uploaded yet'}</div>
          </div>
        ) : (
          <>
            <div className="grid-4">
              {questions.map((q) => (
                <QuestionCard 
                  key={q.id} 
                  question={q} 
                  isAdmin={isAdmin || !!(user && (q as any).author_id === user.id)}
                  onDelete={(e) => deleteQuestion(q, e)}
                  onClick={() => router.push(`/questions/${q.id}`)}
                />
              ))}
            </div>
            
            {hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
                <button className="btn btn-ghost" onClick={() => fetchQuestions()} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : 'Load More Questions'}
                </button>
              </div>
            )}
          </>
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
