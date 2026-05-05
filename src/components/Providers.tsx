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
type User = {
  id: string;
  username: string;
};

type UserCtx = { 
  user: User | null;
  setUser: (u: User | null) => void;
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
  adminPassword?: string;
  setAdminPassword: (pw: string) => void;
};

const UserContext = createContext<UserCtx>({ 
  user: null,
  setUser: () => {},
  isAdmin: false,
  setIsAdmin: () => {},
  setAdminPassword: () => {},
});

export const useUser = () => useContext(UserContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isAdmin, setIsAdminState] = useState(false);
  const [adminPassword, setAdminPasswordState] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Load user
    const savedUser = localStorage.getItem('dh_user');
    if (savedUser) {
      try {
        setUserState(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('dh_user');
      }
    }
    
    // Load admin status
    const savedAdmin = localStorage.getItem('dh_is_admin');
    if (savedAdmin === 'true') {
      setIsAdminState(true);
      const savedPw = localStorage.getItem('dh_admin_pw');
      if (savedPw) setAdminPasswordState(savedPw);
    }

    setReady(true);
  }, []);

  const setUser = (u: User | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem('dh_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('dh_user');
    }
  };

  const setIsAdmin = (val: boolean) => {
    setIsAdminState(val);
    localStorage.setItem('dh_is_admin', val ? 'true' : 'false');
    if (!val) {
      setAdminPasswordState('');
      localStorage.removeItem('dh_admin_pw');
    }
  };

  const setAdminPassword = (pw: string) => {
    setAdminPasswordState(pw);
    localStorage.setItem('dh_admin_pw', pw);
  };

  if (!ready) return null;
  return (
    <UserContext.Provider value={{ user, setUser, isAdmin, setIsAdmin, adminPassword, setAdminPassword }}>
      {children}
    </UserContext.Provider>
  );
}
