'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase, Subject } from '@/lib/supabase';
import { useUser, useToast } from '@/components/Providers';
import { useRouter } from 'next/navigation';
import { Plus, BookOpen, Trash2, Pencil, Search, X, FolderOpen, Download } from 'lucide-react';
import { generateGlobalPDF } from '@/lib/pdf';

const EMOJIS = ['📘', '📗', '📕', '📙', '🧮', '🔬', '🌍', '💻', '📐', '🎨', '🧬', '📖', '⚗️', '🏛️', '🎵'];

export default function HomePage() {
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [subjects, setSubjects] = useState<(Subject & { emoji: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: '', description: '', emoji: EMOJIS[0] });
  const [saving, setSaving] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [dlProgress, setDlProgress] = useState(0);

  const handleGlobalDownload = async () => {
    setDownloadingAll(true);
    setDlProgress(0);
    try {
      toast('Fetching all subjects and questions...');
      const { data: allData, error } = await supabase
        .from('subjects')
        .select(`
          name,
          questions(
            *,
            question_images(*),
            solutions(*, solution_images(*))
          )
        `);
      
      if (error) throw error;
      
      const formatted = (allData || []).map(s => ({
        title: s.name,
        questions: (s.questions || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      }));

      toast('Downloading images...');
      await generateGlobalPDF(formatted, (p) => setDlProgress(p));
      toast('Full backup ready! ✓');
    } catch (e: any) {
      toast(e.message || 'Download failed', 'error');
    }
    setDownloadingAll(false);
    setDlProgress(0);
  };

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('subjects')
      .select(`*, questions(count)`)
      .order('created_at', { ascending: false });
    if (error) { toast('Failed to load subjects', 'error'); setLoading(false); return; }

    const enriched = (data || []).map((s: any) => ({
      ...s,
      emoji: s.emoji || EMOJIS[Math.abs(s.name.charCodeAt(0)) % EMOJIS.length],
      question_count: s.questions?.[0]?.count ?? 0,
    }));
    setSubjects(enriched);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  const openCreate = () => { setEditTarget(null); setForm({ name: '', description: '', emoji: EMOJIS[0] }); setShowModal(true); };
  const openEdit = (s: Subject & { emoji: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTarget(s);
    setForm({ name: s.name, description: s.description || '', emoji: s.emoji });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editTarget) {
      const { error } = await supabase.from('subjects').update({
        name: form.name.trim(), description: form.description.trim() || null, emoji: form.emoji,
      }).eq('id', editTarget.id);
      if (error) { console.error(error); toast(error.message, 'error'); }
      else { toast('Subject updated ✓'); setShowModal(false); fetchSubjects(); }
    } else {
      const { error } = await supabase.from('subjects').insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        emoji: form.emoji, created_by_name: user?.username || 'Anonymous',
      }).select().single();
      if (error) { console.error(error); toast(error.message, 'error'); }
      else { toast('Subject created ✓'); setShowModal(false); fetchSubjects(); }
    }
    setSaving(false);
  };

  const handleDelete = async (s: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const pw = prompt('Admin Password required to clear this subject:');
    if (pw !== 'doubt_hub_admin_2024') {
      if (pw !== null) toast('Invalid password', 'error');
      return;
    }

    if (!confirm(`Clear all questions and solutions for "${s.name}"? This cannot be undone.`)) return;
    
    setSaving(true);
    try {
      // Robustly delete all questions for this subject. 
      // Storage images will need cleanup too for a perfect fix, 
      // but the user focused on database deletion here.
      const { error } = await supabase.from('questions').delete().eq('subject_id', s.id);
      if (error) throw error;
      
      toast(`All doubts cleared from ${s.name} ✓`);
      fetchSubjects();
    } catch (e: any) {
      toast(e.message || 'Failed to clear subject', 'error');
    }
    setSaving(false);
  };

  const filtered = subjects.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <div className="container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Study Subjects</h1>
            <p className="page-subtitle">Organize doubts by subject. Anyone can view and contribute.</p>
          </div>
          {user ? (
            <button className="btn btn-primary" onClick={openCreate} id="add-subject-btn">
              <Plus size={16} /> New Subject
            </button>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', opacity: 0.7 }}>
              Login to add subjects
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 28, alignItems: 'center' }}>
          <div className="search-wrap" style={{ flex: 1, marginBottom: 0 }}>
            <Search size={16} className="search-icon" />
            <input
              className="search-input"
              placeholder="Search subjects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="subject-search"
            />
          </div>
          {isAdmin && (
            <button 
              className="btn btn-ghost" 
              onClick={handleGlobalDownload} 
              disabled={downloadingAll}
              style={{ gap: 8, height: 48, whiteSpace: 'nowrap', minWidth: 140 }}
            >
              {downloadingAll ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                  <span>{dlProgress}%</span>
                </div>
              ) : (
                <><Download size={16} /> <span>Full Backup</span></>
              )}
            </button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FolderOpen size={56} /></div>
            <div className="empty-title">
              {search ? 'No subjects found' : 'No subjects yet'}
            </div>
            <div className="empty-desc">
              {search ? 'Try a different search term' : 'Create your first subject folder to start uploading doubts!'}
            </div>
          </div>
        ) : (
          <div className="grid-3">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="subject-card"
                onClick={() => router.push(`/subjects/${s.id}`)}
                id={`subject-${s.id}`}
              >
                {isAdmin && (
                  <div className="subject-card-actions">
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={(e) => openEdit(s, e)} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => handleDelete(s, e)} title="Clear All">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
                <div className="subject-card-emoji">{s.emoji}</div>
                <div className="subject-card-name">{s.name}</div>
                {s.description && <div className="subject-card-desc">{s.description}</div>}
                <div className="subject-card-stats">
                  <div className="stat-pill">
                    <BookOpen size={12} />
                    {s.question_count} doubts
                  </div>
                  <div className="stat-pill" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    By {s.created_by_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editTarget ? 'Edit Subject' : 'New Subject'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            {/* Emoji picker */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  onClick={() => setForm((f) => ({ ...f, emoji: em }))}
                  style={{
                    fontSize: '1.5rem', padding: '6px 10px',
                    background: form.emoji === em ? 'var(--accent-dim)' : 'var(--bg-card)',
                    border: `2px solid ${form.emoji === em ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    transition: 'all var(--transition)',
                  }}
                >{em}</button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Subject Name *</label>
                <input className="form-input" placeholder="e.g. Physics, Mathematics..."
                  value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea className="form-input form-textarea" placeholder="What topics does this subject cover?"
                  value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving...' : editTarget ? 'Update Subject' : 'Create Subject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
