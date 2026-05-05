'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Toast = { id: number; message: string; type: 'success' | 'error' };
type ToastCtx = { toast: (msg: string, type?: 'success' | 'error') => void };

const ToastContext = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.type === 'success' ? '✅' : '❌'}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ─── Username Context ─────────────────────────── */
type UserCtx = { 
  username: string; 
  setUsername: (n: string) => void;
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
  userId: string;
};
const UserContext = createContext<UserCtx>({ 
  username: 'Anonymous', 
  setUsername: () => {},
  isAdmin: false,
  setIsAdmin: () => {},
  userId: ''
});
export const useUser = () => useContext(UserContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsernameState] = useState('Anonymous');
  const [isAdmin, setIsAdminState] = useState(false);
  const [userId, setUserId] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Load username
    const saved = localStorage.getItem('dh_username');
    if (saved) setUsernameState(saved);
    
    // Load admin status
    const savedAdmin = localStorage.getItem('dh_is_admin');
    if (savedAdmin === 'true') setIsAdminState(true);

    // Load or Generate unique userId
    let savedId = localStorage.getItem('dh_user_id');
    if (!savedId) {
      savedId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('dh_user_id', savedId);
    }
    setUserId(savedId);
    
    setReady(true);
  }, []);

  const setUsername = (n: string) => {
    setUsernameState(n);
    localStorage.setItem('dh_username', n);
  };

  const setIsAdmin = (val: boolean) => {
    setIsAdminState(val);
    localStorage.setItem('dh_is_admin', val ? 'true' : 'false');
  };

  if (!ready) return null;
  return (
    <UserContext.Provider value={{ username, setUsername, isAdmin, setIsAdmin, userId }}>
      {children}
    </UserContext.Provider>
  );
}
