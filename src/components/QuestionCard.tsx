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
  onDelete: (q: any, e: React.MouseEvent) => void;
  onClick: () => void;
};

import { ImageIcon } from 'lucide-react';

export default function QuestionCard({ question: q, isAdmin, onDelete, onClick }: QuestionCardProps) {
  const status = STATUS_CONFIG[q.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.unsolved;
  const mainImg = q.question_images?.[0]?.storage_path;
  const imgUrl = mainImg 
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/doubt-images/${mainImg}`
    : null;
  
  const imgCount = q.question_images?.length ?? 0;
  const solCount = q.solutions?.length ?? 0;

  return (
    <div className="question-card" onClick={onClick}>
      <div className="question-card-thumb">
        {imgUrl ? (
          <Image 
            src={imgUrl} 
            alt={q.title} 
            fill 
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <div className="question-card-thumb-placeholder">📷</div>
        )}
        <span className={`status-badge ${status.cls}`}>
          {status.icon} {status.label}
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
            {solCount > 0 && (
              <span className="image-count-badge" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>✓ sol</span>
            )}
            {isAdmin && (
              <button className="btn btn-danger btn-sm btn-icon" style={{ width: 26, height: 26 }}
                onClick={(e) => { e.stopPropagation(); onDelete(q, e); }} title="Delete question">
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
