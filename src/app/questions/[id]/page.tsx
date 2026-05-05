'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { supabase, Question } from '@/lib/supabase';
import { useUser, useToast } from '@/components/Providers';
import ImageCarousel from '@/components/ImageCarousel';
import UploadZone, { PreviewFile } from '@/components/UploadZone';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, Pencil, Save, X, CheckCircle2, Clock, HelpCircle,
  ImagePlus, FileText, Trash2, RotateCcw, Plus, User as UserIcon
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
  const [solutions, setSolutions] = useState<any[]>([]);
  const [qImages, setQImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Solution edit state
  const [editingSolutionId, setEditingSolutionId] = useState<string | null>(null); // 'new' or UUID
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

    const sols = (q.solutions || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setSolutions(sols);

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
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft' && prevQ) router.push(`/questions/${prevQ}`);
      else if (e.key === 'ArrowRight' && nextQ) router.push(`/questions/${nextQ}`);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevQ, nextQ, router]);

  const saveSolution = async () => {
    setSavingSolution(true);
    try {
      const isNew = editingSolutionId === 'new';
      let solId = isNew ? null : editingSolutionId;

      if (!isNew && solId) {
        await supabase.from('solutions').update({
          text_content: solutionText.trim() || null,
          updated_by_name: user?.username || 'Anonymous',
          updated_at: new Date().toISOString(),
        }).eq('id', solId);
      } else {
        const { data: newSol, error } = await supabase.from('solutions').insert({
          question_id: id,
          text_content: solutionText.trim() || null,
          created_by_name: user?.username || 'Anonymous',
          author_id: user?.id || null,
        }).select().single();
        if (error) throw error;
        solId = newSol.id;
      }

      for (let i = 0; i < solutionFiles.length; i++) {
        const f = solutionFiles[i];
        const path = `solutions/${solId}/${Date.now()}_${i}.webp`;
        const { error: upErr } = await supabase.storage.from('doubt-images').upload(path, f.file, { contentType: 'image/webp' });
        if (upErr) throw upErr;
        
        const sol = solutions.find(s => s.id === solId);
        const existingCount = sol?.solution_images?.length || 0;
        await supabase.from('solution_images').insert({ solution_id: solId, storage_path: path, page_order: existingCount + i });
      }

      if (question?.status === 'unsolved') {
        await supabase.from('questions').update({ status: 'in_progress' }).eq('id', id);
      }

      toast('Solution saved ✓');
      setEditingSolutionId(null);
      setSolutionText('');
      setSolutionFiles([]);
      setShowSolution(true);
      fetchAll();
    } catch (e: any) {
      toast(e.message || 'Failed to save', 'error');
    }
    setSavingSolution(false);
  };

  const deleteSolution = async (solId: string) => {
    if (!confirm('Are you sure you want to delete this solution?')) return;
    try {
      const sol = solutions.find(s => s.id === solId);
      if (sol?.solution_images) {
        const paths = sol.solution_images.map((img: any) => img.storage_path);
        if (paths.length > 0) await supabase.storage.from('doubt-images').remove(paths);
      }
      await supabase.from('solutions').delete().eq('id', solId);
      toast('Solution deleted ✓');
      fetchAll();
    } catch (e: any) {
      toast(e.message || 'Failed to delete solution', 'error');
    }
  };

  const updateStatus = async (status: string) => {
    setUpdatingStatus(true);
    await supabase.from('questions').update({ status }).eq('id', id);
    setQuestion((q) => q ? { ...q, status: status as any } : q);
    toast(`Status updated to ${status}`);
    setUpdatingStatus(false);
  };

  if (loading) return <div className="page"><div className="container"><div className="loading-state"><div className="spinner" /></div></div></div>;
  if (!question) return <div className="page"><div className="container"><div className="empty-state"><div className="empty-title">Question not found</div></div></div></div>;

  return (
    <div className="page">
      <div className="container">
        <div className="sticky-controls">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="breadcrumb" style={{ marginBottom: 0 }}>
              <Link href="/">Home</Link>
              <ChevronRight size={14} />
              <Link href={`/subjects/${question.subject_id}`}>Subject</Link>
              <ChevronRight size={14} />
              <span>Detail</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={prevQ ? `/questions/${prevQ}` : '#'} className={`btn btn-sm ${prevQ ? 'btn-ghost' : 'btn-disabled'}`} style={{ width: 'auto', padding: '6px 12px', opacity: prevQ ? 1 : 0.3, pointerEvents: prevQ ? 'auto' : 'none' }}>← Prev</Link>
              <Link href={nextQ ? `/questions/${nextQ}` : '#'} className={`btn btn-sm ${nextQ ? 'btn-ghost' : 'btn-disabled'}`} style={{ width: 'auto', padding: '6px 12px', opacity: nextQ ? 1 : 0.3, pointerEvents: nextQ ? 'auto' : 'none' }}>Next →</Link>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ fontSize: '1.6rem' }}>{question.title}</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              {STATUS_OPTIONS.map((s) => (
                <button key={s.value} className={`btn btn-sm ${question.status === s.value ? s.cls : 'btn-ghost'}`} onClick={() => updateStatus(s.value)} disabled={updatingStatus || question.status === s.value} style={question.status === s.value ? { background: 'none', border: '1.5px solid currentColor', opacity: 1 } : {}}>{s.icon} {s.label}</button>
              ))}
            </div>
          </div>
          <div className="detail-meta" style={{ marginTop: 12 }}>
            <div className="meta-chip"><UserIcon size={14} /> {question.uploaded_by_name}</div>
            <div className="meta-chip"><Clock size={14} /> {new Date(question.created_at).toLocaleDateString()}</div>
          </div>
          {question.description && <div style={{ marginTop: 16, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{question.description}</div>}
        </div>

        <div className="detail-layout">
          <div className="detail-column">
            <div className="detail-section-title"><ImagePlus size={16} /> Question Images</div>
            {qImages.length > 0 ? <ImageCarousel images={qImages} /> : <div className="empty-placeholder">No images provided</div>}
          </div>

          <div className="detail-column">
            <div className="detail-section-title" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={16} /> Solutions</span>
              {(isAdmin || (user && solutions.length === 0)) && !editingSolutionId && (
                <button className="btn btn-primary btn-sm" onClick={() => { setEditingSolutionId('new'); setSolutionText(''); setSolutionFiles([]); }}><Plus size={14} /> Add Solution</button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {editingSolutionId === 'new' && (
                <div className="card" style={{ padding: 20, borderColor: 'var(--accent)' }}>
                  <div className="solution-panel">
                    <textarea className="rich-editor" placeholder="Write your explanation here..." value={solutionText} onChange={(e) => setSolutionText(e.target.value)} />
                    <UploadZone files={solutionFiles} setFiles={setSolutionFiles} hint="Add solution diagrams/images" />
                    <div className="modal-footer" style={{ marginTop: 16 }}>
                      <button className="btn btn-ghost" onClick={() => setEditingSolutionId(null)}>Cancel</button>
                      <button className="btn btn-primary" onClick={saveSolution} disabled={savingSolution}>{savingSolution ? 'Saving...' : 'Post Solution'}</button>
                    </div>
                  </div>
                </div>
              )}

              {solutions.length === 0 && !editingSolutionId && <div className="empty-placeholder">{user ? 'No solutions yet. Be the first to help!' : 'Login to contribute a solution'}</div>}

              {solutions.map((sol) => {
                const isEditing = editingSolutionId === sol.id;
                const canEdit = isAdmin || (user && (sol.author_id === user.id || (!sol.author_id && sol.created_by_name === user.username)));
                const sImgs = (sol.solution_images || []).sort((a: any, b: any) => a.page_order - b.page_order).map((i: any) => getImageUrl(i.storage_path));

                return (
                  <div key={sol.id} className="card" style={{ overflow: 'visible' }}>
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>By <strong>{sol.created_by_name}</strong> • {new Date(sol.created_at).toLocaleDateString()}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {canEdit && !isEditing && (
                            <>
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditingSolutionId(sol.id); setSolutionText(sol.text_content || ''); setSolutionFiles([]); }}><Pencil size={14} /></button>
                              <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteSolution(sol.id)}><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="solution-panel">
                          <textarea className="rich-editor" value={solutionText} onChange={(e) => setSolutionText(e.target.value)} />
                          <UploadZone files={solutionFiles} setFiles={setSolutionFiles} />
                          <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setEditingSolutionId(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveSolution} disabled={savingSolution}>{savingSolution ? 'Saving...' : 'Update Solution'}</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {!showSolution ? (
                            <div className="empty-placeholder" style={{ borderStyle: 'solid', minHeight: 180 }}><button className="btn btn-primary" onClick={() => setShowSolution(true)}>Reveal Solution</button></div>
                          ) : (
                            <>
                              {sImgs.length > 0 && <ImageCarousel images={sImgs} maxHeight={420} />}
                              {sol.text_content && <div style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{sol.text_content}</div>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
