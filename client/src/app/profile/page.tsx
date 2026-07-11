'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, MapPin, Calendar, Edit3, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { auth, db } from '@lib/firebase';
import { deleteUser } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';

export default function ProfilePage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmed = window.confirm(
      'This will permanently delete your account and all associated data. This cannot be undone. Are you sure?'
    );
    if (!confirmed) return;
    setDeletingAccount(true);
    try {
      // Delete Firestore user doc first
      await deleteDoc(doc(db, 'users', user.uid));
      // Delete Firebase Auth account
      await deleteUser(user);
      router.push('/');
    } catch (err: any) {
      // Firebase requires recent login for deletion
      if (err?.code === 'auth/requires-recent-login') {
        alert('For security, please sign out and sign back in before deleting your account.');
      } else {
        alert('Failed to delete account. Please try again.');
      }
      setDeletingAccount(false);
    }
  };
  
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .profile-header {
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 12px;
          padding: var(--space-6);
          display: flex;
          gap: var(--space-6);
          align-items: center;
          margin-bottom: var(--space-6);
          position: relative;
        }
        .profile-avatar-large {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: var(--neutral-100) url('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix') center/cover;
          border: 4px solid var(--shiro);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .profile-info h1 { margin-bottom: var(--space-1); }
        .profile-meta {
          display: flex; gap: var(--space-5); color: var(--neutral-500); font-size: 14px;
        }
        .profile-meta-item { display: flex; align-items: center; gap: var(--space-2); }
        .edit-profile-btn { position: absolute; top: var(--space-6); right: var(--space-6); }
        .stats-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4); margin-bottom: var(--space-6); }
        .stat-card { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 10px; padding: var(--space-4); text-align: center; }
        .stat-value { font-family: var(--font-display); font-size: 32px; color: var(--neutral-900); line-height: 1; margin-bottom: var(--space-1); }
        .stat-label { font-size: 12px; color: var(--neutral-500); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .section-title { font-family: var(--font-display); font-size: 24px; margin-bottom: var(--space-4); color: var(--neutral-900); }
        .comp-list { display: grid; gap: var(--space-4); }
        .comp-item {
          background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 10px;
          padding: var(--space-4); display: flex; justify-content: space-between; align-items: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .comp-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .comp-info { display: flex; gap: var(--space-4); align-items: center; }
        .comp-date-badge {
          width: 50px; height: 50px; background: var(--neutral-50); border: 1px solid var(--neutral-300);
          border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700;
        }
        .comp-date-day { font-size: 18px; line-height: 1; }
        .comp-date-month { font-size: 10px; text-transform: uppercase; color: var(--neutral-500); }
        .comp-details h4 { font-size: 16px; margin-bottom: 2px; }
        .comp-details p { font-size: 13px; color: var(--neutral-500); }
        .comp-status { display: flex; align-items: center; gap: var(--space-4); }
        @media (max-width: 768px) {
          .profile-header { flex-direction: column; text-align: center; padding: var(--space-7) var(--space-4); }
          .edit-profile-btn { position: static; margin-top: var(--space-4); }
          .profile-meta { flex-direction: column; gap: var(--space-2); align-items: center; }
          .stats-row { grid-template-columns: 1fr; }
          .comp-item { flex-direction: column; align-items: flex-start; gap: var(--space-4); }
          .comp-status { width: 100%; justify-content: space-between; }
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">TaiKaiX / User Profile</div>
            <h1>My Profile</h1>
          </div>
        </header>

        <section className="profile-header">
          <div className="profile-avatar-large" style={{ background: user?.photoURL ? `url(${user.photoURL}) center/cover` : `url('https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'Felix'}') center/cover` }}></div>
          <div className="profile-info">
            <h1>{user?.displayName || 'User Profile'}</h1>
            <div className="profile-meta">
              <div className="profile-meta-item">
                <Mail size={16} />
                {user?.email || 'No email available'}
              </div>
              <div className="profile-meta-item">
                <MapPin size={16} />
                {role ? role.toUpperCase() : 'USER'}
              </div>
            </div>
          </div>
          <Link href="/profile/edit" className="btn btn-secondary edit-profile-btn">
            <Edit3 size={16} /> Edit Profile
          </Link>
        </section>

        <section className="stats-row">
          <div className="stat-card">
            <div className="stat-value">12</div>
            <div className="stat-label">Competitions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">156</div>
            <div className="stat-label">Matches Called</div>
          </div>
        </section>

        <section className="profile-content">
          <h2 className="section-title">Competition History</h2>
          
          <div className="comp-list">
            <div className="comp-item">
              <div className="comp-info">
                <div className="comp-date-badge">
                  <span className="comp-date-day">15</span>
                  <span className="comp-date-month">May</span>
                </div>
                <div className="comp-details">
                  <h4>Kyoto 2026 Finals</h4>
                  <p>Kyoto Imperial Arena</p>
                </div>
              </div>
              <div className="comp-status">
                <span className="status-chip status-live">Live Now</span>
                <Link href="/competitions/1" className="btn btn-ghost" style={{ padding: '8px' }}>
                  <ExternalLink size={16} />
                </Link>
              </div>
            </div>

            <div className="comp-item">
              <div className="comp-info">
                <div className="comp-date-badge">
                  <span className="comp-date-day">02</span>
                  <span className="comp-date-month">Jun</span>
                </div>
                <div className="comp-details">
                  <h4>Osaka Regional Cup</h4>
                  <p>Osaka Prefectural Gym</p>
                </div>
              </div>
              <div className="comp-status">
                <span className="status-chip status-upcoming">Upcoming</span>
                <Link href="#" className="btn btn-ghost" style={{ padding: '8px' }}>
                  <ExternalLink size={16} />
                </Link>
              </div>
            </div>

            <div className="comp-item">
              <div className="comp-info">
                <div className="comp-date-badge">
                  <span className="comp-date-day">10</span>
                  <span className="comp-date-month">Apr</span>
                </div>
                <div className="comp-details">
                  <h4>Tokyo Masters</h4>
                  <p>Nippon Budokan</p>
                </div>
              </div>
              <div className="comp-status">
                <span className="status-chip status-done" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-500)' }}>Completed</span>
                <Link href="/archives/tokyo-masters" className="btn btn-ghost" style={{ padding: '8px' }}>
                  <ExternalLink size={16} />
                </Link>
              </div>
            </div>
            
            <div className="comp-item">
              <div className="comp-info">
                <div className="comp-date-badge">
                  <span className="comp-date-day">22</span>
                  <span className="comp-date-month">Mar</span>
                </div>
                <div className="comp-details">
                  <h4>Nagoya Open 2026</h4>
                  <p>Nagoya City Gym</p>
                </div>
              </div>
              <div className="comp-status">
                <span className="status-chip status-done" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-500)' }}>Completed</span>
                <Link href="/archives/nagoya-open" className="btn btn-ghost" style={{ padding: '8px' }}>
                  <FileText size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Danger Zone: Account Deletion */}
        <section style={{ background: 'var(--shiro)', border: '1px solid color-mix(in oklch, var(--aka) 30%, var(--shiro))', borderRadius: '12px', padding: 'var(--space-5)', marginTop: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--aka)', marginBottom: '8px' }}>Danger Zone</h2>
          <p style={{ fontSize: '13px', color: 'var(--neutral-600)', marginBottom: 'var(--space-4)' }}>Permanently delete your account and all personal data. This cannot be undone.</p>
          <button
            className="btn"
            style={{ background: 'var(--aka)', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
          >
            <Trash2 size={16} />
            {deletingAccount ? 'Deleting...' : 'Delete My Account'}
          </button>
        </section>
      </main>
    </>
  );
}
