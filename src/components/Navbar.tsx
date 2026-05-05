'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useUser } from './Providers';
import { User, Pencil, Check, Shield, ShieldCheck, LogOut } from 'lucide-react';
import { verifyAdminPassword } from '@/app/actions';

export default function Navbar() {
  const { username, setUsername, isAdmin, setIsAdmin } = useUser();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(username);
  const [loggingIn, setLoggingIn] = useState(false);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed) setUsername(trimmed);
    setEditing(false);
  };

  const handleAdminLogin = async () => {
    if (isAdmin) {
      if (confirm('Logout from Admin mode?')) {
        setIsAdmin(false);
      }
      return;
    }

    const pw = prompt('Enter Admin Password:');
    if (!pw) return;

    setLoggingIn(true);
    const success = await verifyAdminPassword(pw);
    if (success) {
      setIsAdmin(true);
      alert('Admin access granted!');
    } else {
      alert('Invalid password');
    }
    setLoggingIn(false);
  };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link href="/" className="logo">
          <div className="logo-icon">📚</div>
          DoubtHub
        </Link>

        <div className="nav-right">
          {/* Admin Toggle */}
          <button 
            className={`username-badge ${isAdmin ? 'admin-active' : ''}`}
            onClick={handleAdminLogin}
            disabled={loggingIn}
            title={isAdmin ? "Logout Admin" : "Admin Login"}
            style={{ 
              background: isAdmin ? 'var(--red-dim)' : 'transparent',
              borderColor: isAdmin ? 'var(--red)' : 'var(--border)',
              marginRight: 8
            }}
          >
            {isAdmin ? <ShieldCheck size={14} color="var(--red)" /> : <Shield size={14} />}
            <span style={{ color: isAdmin ? 'var(--red)' : 'inherit' }}>
              {loggingIn ? 'Checking...' : (isAdmin ? 'Admin' : 'Admin')}
            </span>
            {isAdmin && <LogOut size={12} style={{ marginLeft: 4 }} />}
          </button>

          {editing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="form-input"
                style={{ padding: '7px 12px', width: 160, fontSize: '0.875rem' }}
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
