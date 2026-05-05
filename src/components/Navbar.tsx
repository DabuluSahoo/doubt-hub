'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useUser } from './Providers';
import { User, Pencil, Check } from 'lucide-react';

export default function Navbar() {
  const { username, setUsername } = useUser();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(username);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed) setUsername(trimmed);
    setEditing(false);
  };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link href="/" className="logo">
          <div className="logo-icon">📚</div>
          DoubtHub
        </Link>

        <div className="nav-right">
          {editing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="form-input"
                style={{ padding: '7px 12px', width: 180, fontSize: '0.875rem' }}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                autoFocus
                maxLength={32}
              />
              <button className="btn btn-primary btn-sm btn-icon" onClick={save}>
                <Check size={15} />
              </button>
            </div>
          ) : (
            <button className="username-badge" onClick={() => { setDraft(username); setEditing(true); }}>
              <div className="username-dot" />
              <User size={14} />
              <span>{username}</span>
              <Pencil size={12} style={{ opacity: 0.5 }} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
