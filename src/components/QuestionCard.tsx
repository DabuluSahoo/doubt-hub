'use client';
import Image from 'next/image';
import { HelpCircle, Clock, CheckCircle2, Trash2, Pencil } from 'lucide-react';
import { Question } from '@/lib/supabase';

const STATUS_CONFIG = {
  unsolved:    { label: 'Unsolved',    icon: <HelpCircle size={12} />,    cls: 'status-unsolved' },
  in_progress: { label: 'In Progress', icon: <Clock size={12} />,         cls: 'status-in_progress' },
  solved:      { label: 'Solved',      icon: <CheckCircle2 size={12} />,  cls: 'status-solved' },
};

type QuestionCardProps = {
  question: any;
  isAdmin: boolean;
  onDelete: (e: React.MouseEvent) => void;
  onClick: () => void;
};

import { ImageIcon } from 'lucide-react';

export default function QuestionCard({ question: q, isAdmin, onDelete, onClick }: QuestionCardProps) {
  const status = STATUS_CONFIG[q.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.unsolved;
  const imgCount = q.question_images?.length ?? 0;
  const solCount = q.solutions?.length ?? 0;

  return (
    <div className="question-card no-thumb" onClick={onClick}>
      <div className="question-card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <span className={`status-badge ${status.cls}`} style={{ position: 'static', transform: 'none' }}>
            {status.icon} {status.label}
          </span>
          {isAdmin && (
            <button className="btn btn-danger btn-sm btn-icon" style={{ width: 26, height: 26 }}
              onClick={(e) => { e.stopPropagation(); onDelete(e); }} title="Delete question">
              <Trash2 size={11} />
            </button>
          )}
        </div>

        <div className="question-card-title" style={{ fontSize: '1rem', marginBottom: 12 }}>{q.title}</div>
        
        <div className="question-card-meta" style={{ marginTop: 'auto' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>by {q.uploaded_by_name}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {imgCount > 0 && (
              <span className="image-count-badge">
                <ImageIcon size={10} /> {imgCount}
              </span>
            )}
            {solCount > 0 && (
              <span className="image-count-badge" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>✓ sol</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
