'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useUser } from './Providers';
import { User, Pencil, Check, Shield, ShieldCheck, LogOut, UserPlus, LogIn, X } from 'lucide-react';
import { verifyAdminPassword, registerUser, loginUser } from '@/app/actions';

export default function Navbar() {
  const { user, setUser, isAdmin, setIsAdmin, adminPassword, setAdminPassword } = useUser();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggingInAdmin, setLoggingInAdmin] = useState(false);

  const handleAdminLogin = async () => {
    if (isAdmin) {
      if (confirm('Logout from Admin mode?')) {
        setIsAdmin(false);
      }
      return;
    }

    const pw = prompt('Enter Admin Password:');
    if (!pw) return;

    setLoggingInAdmin(true);
    const success = await verifyAdminPassword(pw);
    if (success) {
      setIsAdmin(true);
      setAdminPassword(pw);
      alert('Admin access granted!');
    } else {
      alert('Invalid password');
    }
    setLoggingInAdmin(false);
  };

  const [regMessage, setRegMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setRegMessage('');
    setLoading(true);

    const res = isRegister 
      ? await registerUser(authUsername, authPassword)
      : await loginUser(authUsername, authPassword);

    if (res.error) {
      setAuthError(res.error);
    } else if ((res as any).success) {
      setRegMessage((res as any).message);
      setAuthUsername('');
      setAuthPassword('');
    } else if (res.user) {
      setUser(res.user);
      setShowAuthModal(false);
      setAuthUsername('');
      setAuthPassword('');
    }
    setLoading(false);
  };

  return (
    <>
      <nav className="navbar">
        <div className="container navbar-inner">
          <Link href="/" className="logo">
            <div className="logo-icon">📚</div>
            <span>DoubtHub</span>
          </Link>

          <div className="nav-right">
            {isAdmin && (
              <Link href="/admin" className="btn btn-ghost btn-sm" style={{ marginRight: 8 }}>
                <Shield size={14} /> Users
              </Link>
            )}
            {/* Admin Toggle */}
            <button 
              className={`username-badge ${isAdmin ? 'admin-active' : ''}`}
              onClick={handleAdminLogin}
              disabled={loggingInAdmin}
              title={isAdmin ? "Logout Admin" : "Admin Login"}
              style={{ 
                background: isAdmin ? 'var(--red-dim)' : 'transparent',
                borderColor: isAdmin ? 'var(--red)' : 'var(--border)',
                marginRight: 8
              }}
            >
              {isAdmin ? <ShieldCheck size={14} color="var(--red)" /> : <Shield size={14} />}
              <span style={{ color: isAdmin ? 'var(--red)' : 'inherit' }}>
                {isAdmin ? 'Admin' : 'Admin'}
              </span>
            </button>

            {user ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="username-badge" style={{ cursor: 'default' }}>
                  <div className="username-dot" />
                  <User size={14} />
                  <span>{user.username}</span>
                </div>
                <button 
                  className="btn btn-ghost btn-sm btn-icon" 
                  onClick={() => { setUser(null); setIsAdmin(false); }}
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAuthModal(true)}>
                <LogIn size={14} /> Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
              <button className="modal-close" onClick={() => setShowAuthModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              {regMessage && (
                <div style={{ color: 'var(--green)', background: 'var(--green-dim)', padding: '12px', borderRadius: 8, fontSize: '0.875rem', textAlign: 'center', fontWeight: 500 }}>
                  {regMessage}
                </div>
              )}
              {authError && (
                <div style={{ color: 'var(--red)', background: 'var(--red-dim)', padding: '8px 12px', borderRadius: 8, fontSize: '0.875rem' }}>
                  {authError}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  className="form-input" 
                  required 
                  value={authUsername} 
                  onChange={e => setAuthUsername(e.target.value)}
                  placeholder="Your unique name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  className="form-input" 
                  type="password" 
                  required 
                  value={authPassword} 
                  onChange={e => setAuthPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
              </div>
              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? 'Processing...' : (isRegister ? 'Register' : 'Login')}
              </button>
              <button 
                type="button"
                className="btn btn-ghost w-full" 
                onClick={() => { setIsRegister(!isRegister); setAuthError(''); setRegMessage(''); }}
                style={{ fontSize: '0.875rem' }}
              >
                {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
