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
type UserCtx = { username: string; setUsername: (n: string) => void };
const UserContext = createContext<UserCtx>({ username: 'Anonymous', setUsername: () => {} });
export const useUser = () => useContext(UserContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsernameState] = useState('Anonymous');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('dh_username');
    if (saved) setUsernameState(saved);
    setReady(true);
  }, []);

  const setUsername = (n: string) => {
    setUsernameState(n);
    localStorage.setItem('dh_username', n);
  };

  if (!ready) return null;
  return <UserContext.Provider value={{ username, setUsername }}>{children}</UserContext.Provider>;
}
