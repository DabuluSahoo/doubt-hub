'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { supabase, Question, Solution } from '@/lib/supabase';
import { useUser, useToast } from '@/components/Providers';
import ImageCarousel from '@/components/ImageCarousel';
import UploadZone, { PreviewFile } from '@/components/UploadZone';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, Pencil, Save, X, CheckCircle2, Clock, HelpCircle,
  ImagePlus, FileText, Trash2, RotateCcw
} from 'lucide-react';

type Props = { params: Promise<{ id: string }> };

const STATUS_OPTIONS = [
  { value: 'unsolved',    label: 'Unsolved',     cls: 'status-unsolved',    icon: <HelpCircle size={14} /> },
  { value: 'in_progress', label: 'In Progress',  cls: 'status-in_progress', icon: <Clock size={14} /> },
  { value: 'solved',      label: 'Solved',       cls: 'status-solved',      icon: <CheckCircle2 size={14} /> },
];

function getImageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/doubt-images/${path}`;
}

export default function QuestionPage({ params }: Props) {
  const { id } = use(params);
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [question, setQuestion] = useState<Question | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [qImages, setQImages] = useState<string[]>([]);
  const [sImages, setSImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Solution edit state
  const [editingSolution, setEditingSolution] = useState(false);
  const [solutionText, setSolutionText] = useState('');
  const [solutionFiles, setSolutionFiles] = useState<PreviewFile[]>([]);
  const [savingSolution, setSavingSolution] = useState(false);

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const [prevQ, setPrevQ] = useState<string | null>(null);
  const [nextQ, setNextQ] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: q } = await supabase
      .from('questions')
      .select(`*, question_images(*), solutions(*, solution_images(*))`)
      .eq('id', id)
      .single();

    if (!q) { setLoading(false); return; }
    setQuestion(q);

    const imgs = (q.question_images || [])
      .sort((a: any, b: any) => a.page_order - b.page_order)
      .map((i: any) => getImageUrl(i.storage_path));
    setQImages(imgs);

    const sol = q.solutions?.[0] || null;
    setSolution(sol);
    setSolutionText(sol?.text_content || '');

    if (sol?.solution_images) {
      const simgs = sol.solution_images
        .sort((a: any, b: any) => a.page_order - b.page_order)
        .map((i: any) => getImageUrl(i.storage_path));
      setSImages(simgs);
    }

    // Fetch sibling question IDs for navigation
    const { data: siblings } = await supabase
      .from('questions')
      .select('id')
      .eq('subject_id', q.subject_id)
      .order('created_at', { ascending: false });

    if (siblings) {
      const idx = siblings.findIndex(s => s.id === id);
      if (idx > 0) setPrevQ(siblings[idx - 1].id);
      if (idx < siblings.length - 1) setNextQ(siblings[idx + 1].id);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      
      if (e.key === 'ArrowLeft' && prevQ) {
        router.push(`/questions/${prevQ}`);
      } else if (e.key === 'ArrowRight' && nextQ) {
        router.push(`/questions/${nextQ}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevQ, nextQ, router]);

  /* ─── Save Solution ──────────────────────────────── */
  const saveSolution = async () => {
    setSavingSolution(true);
    try {
      let solId = solution?.id;

      if (solId) {
        // Update existing
        await supabase.from('solutions').update({
          text_content: solutionText.trim() || null,
          updated_by_name: user?.username || 'Anonymous',
          updated_at: new Date().toISOString(),
        }).eq('id', solId);
      } else {
        // Create new
        const { data: newSol, error } = await supabase.from('solutions').insert({
          question_id: id,
          text_content: solutionText.trim() || null,
          created_by_name: user?.username || 'Anonymous',
          author_id: user?.id || null,
        }).select().single();
        if (error) throw error;
        solId = newSol.id;
      }

      // Upload new solution images
      for (let i = 0; i < solutionFiles.length; i++) {
        const f = solutionFiles[i];
        const path = `solutions/${solId}/${Date.now()}_${i}.webp`;
        const { error: upErr } = await supabase.storage
          .from('doubt-images')
          .upload(path, f.file, { contentType: 'image/webp' });
        if (upErr) throw upErr;
        const existingCount = sImages.length;
        await supabase.from('solution_images').insert({
          solution_id: solId, storage_path: path, page_order: existingCount + i,
        });
      }

      // Auto-mark as solved if solution is added
      if (question?.status === 'unsolved') {
        await supabase.from('questions').update({ status: 'in_progress' }).eq('id', id);
      }

      toast('Solution saved ✓');
      setEditingSolution(false);
      setShowSolution(true);
      setSolutionFiles([]);
      fetchAll();
    } catch (e: any) {
      toast(e.message || 'Failed to save', 'error');
    }
    setSavingSolution(false);
  };

  const deleteSolutionImage = async (imgPath: string, imgId: string) => {
    await supabase.storage.from('doubt-images').remove([imgPath]);
    await supabase.from('solution_images').delete().eq('id', imgId);
    toast('Image removed');
    fetchAll();
  };

  const updateStatus = async (status: string) => {
    setUpdatingStatus(true);
    await supabase.from('questions').update({ status }).eq('id', id);
    setQuestion((q) => q ? { ...q, status: status as any } : q);
    toast(`Status updated to ${status}`);
    setUpdatingStatus(false);
  };

  const deleteSolution = async () => {
    if (!solution) return;
    if (!confirm('Are you sure you want to delete this solution?')) return;

    try {
      // 1. Delete all solution images from storage
      const { data: images } = await supabase.from('solution_images').select('storage_path').eq('solution_id', solution.id);
      if (images && images.length > 0) {
        const paths = images.map(img => img.storage_path);
        await supabase.storage.from('doubt-images').remove(paths);
      }

      // 2. Delete the solution (on delete cascade handles solution_images)
      await supabase.from('solutions').delete().eq('id', solution.id);

      toast('Solution deleted ✓');
      fetchAll();
    } catch (e: any) {
      toast(e.message || 'Failed to delete solution', 'error');
    }
  };

  if (loading) return <div className="page"><div className="container"><div className="loading-state"><div className="spinner" /></div></div></div>;
  if (!question) return <div className="page"><div className="container"><div className="empty-state"><div className="empty-title">Question not found</div></div></div></div>;

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === question.status)!;

  return (
    <div className="page">
      <div className="container">
        {/* Header Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="breadcrumb" style={{ marginBottom: 0 }}>
            <Link href="/">Home</Link>
            <ChevronRight size={14} />
            <Link href={`/subjects/${question.subject_id}`}>Subject</Link>
            <ChevronRight size={14} />
            <span>{question.title}</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Link
              href={prevQ ? `/questions/${prevQ}` : '#'}
              className={`btn btn-sm ${prevQ ? 'btn-ghost' : ''}`}
              style={{ padding: '6px 12px', opacity: prevQ ? 1 : 0.3, pointerEvents: prevQ ? 'auto' : 'none', background: prevQ ? 'var(--bg-card)' : 'transparent', border: '1px solid var(--border)' }}
              title="Previous Question"
            >
              ← Prev
            </Link>
            <Link
              href={nextQ ? `/questions/${nextQ}` : '#'}
              className={`btn btn-sm ${nextQ ? 'btn-ghost' : ''}`}
              style={{ padding: '6px 12px', opacity: nextQ ? 1 : 0.3, pointerEvents: nextQ ? 'auto' : 'none', background: nextQ ? 'var(--bg-card)' : 'transparent', border: '1px solid var(--border)' }}
              title="Next Question"
            >
              Next →
            </Link>
          </div>
        </div>

        {/* Title + Meta */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ fontSize: '1.6rem' }}>{question.title}</h1>
            {/* Status Selector */}
            <div style={{ display: 'flex', gap: 8 }}>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  className={`btn btn-sm ${question.status === s.value ? s.cls : 'btn-ghost'}`}
                  onClick={() => updateStatus(s.value)}
                  disabled={updatingStatus || question.status === s.value}
                  style={question.status === s.value ? { background: 'none', border: '1.5px solid currentColor', opacity: 1 } : {}}
                  title={`Mark as ${s.label}`}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {question.description && (
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>{question.description}</p>
          )}

          <div className="detail-meta">
            <div className="meta-chip">👤 Uploaded by <strong>{question.uploaded_by_name}</strong></div>
            <div className="meta-chip">🕐 {new Date(question.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <div className="meta-chip">📸 {qImages.length} image{qImages.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="detail-layout">

          {/* LEFT: Question Images */}
          <div className="detail-column">
            <div className="detail-section-title" style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 10, paddingBottom: 12 }}>
              <FileText size={14} /> Question
            </div>
            {qImages.length > 0
              ? <ImageCarousel images={qImages} />
              : (
                <div className="empty-placeholder">
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
                  <div style={{ fontWeight: 600 }}>No images attached</div>
                </div>
              )}
          </div>

          {/* RIGHT: Solution */}
          <div className="detail-column">
            <div className="detail-section-title" style={{ justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 10, paddingBottom: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={14} /> Solution
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {editingSolution ? (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingSolution(false); setSolutionFiles([]); setSolutionText(solution?.text_content || ''); }}>
                      <RotateCcw size={12} /> Discard
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={saveSolution} disabled={savingSolution}>
                      <Save size={12} /> {savingSolution ? 'Saving...' : 'Save'}
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {solution && (isAdmin || (user && ((solution as any).author_id === user.id || (!(solution as any).author_id && solution.created_by_name === user.username)))) && (
                      <button className="btn btn-danger btn-sm btn-icon" onClick={deleteSolution} title="Delete solution">
                        <Trash2 size={12} />
                      </button>
                    )}
                    {(!solution || isAdmin || (user && ((solution as any).author_id === user.id || (!(solution as any).author_id && (solution as any).created_by_name === user.username)))) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingSolution(true)} id="edit-solution-btn">
                        <Pencil size={12} /> {solution ? 'Edit' : 'Add Solution'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* View mode */}
            {!editingSolution && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {solution || sImages.length > 0 ? (
                  !showSolution ? (
                    <div className="empty-placeholder" style={{ borderStyle: 'solid' }}>
                      <div style={{ fontSize: '2rem', marginBottom: 16 }}>👀</div>
                      <div style={{ fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Solution is hidden to prevent spoilers</div>
                      <button className="btn btn-primary" onClick={() => setShowSolution(true)}>
                        Reveal Solution
                      </button>
                    </div>
                  ) : (
                    <>
                      {sImages.length > 0 && <ImageCarousel images={sImages} maxHeight={420} />}
                      {solution?.text_content && (
                        <div style={{
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)', padding: '16px 18px',
                          color: 'var(--text-primary)', lineHeight: 1.75, whiteSpace: 'pre-wrap',
                          fontSize: '0.9375rem'
                        }}>
                          {solution.text_content}
                        </div>
                      )}
                      {solution && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {solution.updated_by_name
                            ? `Last edited by ${solution.updated_by_name} · ${new Date(solution.updated_at).toLocaleDateString()}`
                            : `Added by ${solution.created_by_name} · ${new Date(solution.created_at).toLocaleDateString()}`}
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <div className="empty-placeholder">
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>💡</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No solution yet</div>
                    <div style={{ fontSize: '0.8rem' }}>Click "Add Solution" to contribute!</div>
                  </div>
                )}
              </div>
            )}

            {/* Edit mode */}
            {editingSolution && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Existing solution images */}
                {sImages.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Existing images (click × to remove):</div>
                    <div className="image-preview-strip">
                      {(solution?.images || []).sort((a, b) => a.page_order - b.page_order).map((img, i) => (
                        <div key={img.id} className="image-preview-item">
                          <img src={getImageUrl(img.storage_path)} alt={`sol-${i}`} />
                          <div className="image-preview-remove" onClick={() => deleteSolutionImage(img.storage_path, img.id)}>
                            <X size={10} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Written Solution</label>
                  <textarea
                    className="rich-editor"
                    placeholder="Type your solution, explanation, or steps here..."
                    value={solutionText}
                    onChange={(e) => setSolutionText(e.target.value)}
                    rows={6}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Add Solution Images (handwritten notes, diagrams...)</label>
                  <UploadZone onFilesChange={setSolutionFiles} label="solution images" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
