'use client';
import { useEffect, useState } from 'react';
import { useUser, useToast } from '@/components/Providers';
import { getPendingUsers, approveUser, deleteUser } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { Shield, Check, X, User, Clock } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const { isAdmin, adminPassword } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
      return;
    }
    fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await getPendingUsers(adminPassword || '');
    if (res.error) {
      toast(res.error, 'error');
    } else {
      setPendingUsers(res.users || []);
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    const res = await approveUser(adminPassword || '', id);
    if (res.success) {
      toast('User approved ✓');
      fetchUsers();
    } else {
      toast(res.error || 'Failed to approve', 'error');
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject/delete this registration?')) return;
    const res = await deleteUser(adminPassword || '', id);
    if (res.success) {
      toast('Registration rejected');
      fetchUsers();
    } else {
      toast(res.error || 'Failed to reject', 'error');
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Shield size={28} color="var(--red)" />
              User Approvals
            </h1>
            <p className="page-subtitle">Review and approve new member registrations.</p>
          </div>
          <Link href="/" className="btn btn-ghost">Back Home</Link>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : pendingUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <div className="empty-title">No pending requests</div>
            <div className="empty-desc">All new users have been processed.</div>
          </div>
        ) : (
          <div className="admin-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingUsers.map(u => (
              <div key={u.id} className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div className="avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> Registered {new Date(u.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleApprove(u.id)}>
                    <Check size={14} /> Approve
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleReject(u.id)}>
                    <X size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
