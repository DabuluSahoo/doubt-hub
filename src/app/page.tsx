'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase, Subject } from '@/lib/supabase';
import { useUser, useToast } from '@/components/Providers';
import { useRouter } from 'next/navigation';
import { Plus, BookOpen, Trash2, Pencil, Search, X, FolderOpen } from 'lucide-react';

const EMOJIS = ['📘', '📗', '📕', '📙', '🧮', '🔬', '🌍', '💻', '📐', '🎨', '🧬', '📖', '⚗️', '🏛️', '🎵'];

export default function HomePage() {
  const { username } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [subjects, setSubjects] = useState<(Subject & { emoji: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: '', description: '', emoji: EMOJIS[0] });
  const [saving, setSaving] = useState(false);

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
        name: form.name.trim(), description: form.description.trim() || null,
        emoji: form.emoji, created_by_name: username,
      });
      if (error) { console.error(error); toast(error.message, 'error'); }
      else { toast('Subject created ✓'); setShowModal(false); fetchSubjects(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this subject and all its questions?')) return;
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) toast('Failed to delete', 'error');
    else { toast('Subject deleted'); fetchSubjects(); }
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
          <button className="btn btn-primary" onClick={openCreate} id="add-subject-btn">
            <Plus size={16} /> New Subject
          </button>
        </div>

        {/* Search */}
        <div className="search-wrap" style={{ marginBottom: 28 }}>
          <Search size={16} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="subject-search"
          />
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
                <div className="subject-card-actions">
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={(e) => openEdit(s, e)} title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => handleDelete(s.id, e)} title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
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
