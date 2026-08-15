'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, ArrowLeft, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@lib/firebase';

export default function EditProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.displayName) {
      setName(user.displayName);
    }
  }, [user?.displayName]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (user) {
        await updateProfile(user, { displayName: name });
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { displayName: name, name: name });
      }
      setSaving(false);
      setSaved(true);
      setTimeout(() => {
        router.push('/profile');
      }, 800);
    } catch (error) {
      console.error('Failed to update profile', error);
      setSaving(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .edit-grid { display: grid; grid-template-columns: 280px 1fr; gap: var(--space-7); align-items: start; }
        .avatar-upload { text-align: center; background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 12px; padding: var(--space-6); position: sticky; top: 130px; }
        .avatar-preview { width: 140px; height: 140px; border-radius: 50%; margin: 0 auto var(--space-4); border: 4px solid var(--shiro); box-shadow: 0 4px 12px rgba(0,0,0,0.1); position: relative; }
        .avatar-edit-btn { position: absolute; bottom: 0; right: 0; width: 40px; height: 40px; background: var(--aka); color: var(--shiro); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid var(--shiro); cursor: pointer; transition: transform 0.2s; }
        .avatar-edit-btn:hover { transform: scale(1.1); }
        .form-card { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 12px; padding: var(--space-7); }
        .form-section { margin-bottom: var(--space-7); }
        .form-section:last-child { margin-bottom: 0; }
        .form-section-title { font-size: 18px; font-weight: 600; margin-bottom: var(--space-4); padding-bottom: var(--space-2); border-bottom: 1px solid var(--neutral-100); }
        .input-group { margin-bottom: var(--space-4); }
        .input-group label { display: block; font-size: 13px; font-weight: 600; color: var(--neutral-700); margin-bottom: var(--space-2); }
        .form-input, .form-select, .form-textarea { width: 100%; padding: 10px 14px; border: 1.5px solid var(--neutral-300); border-radius: 8px; font-family: var(--font-body); font-size: 14px; color: var(--neutral-900); outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--ao); box-shadow: 0 0 0 3px rgba(26,77,181,0.12); }
        .form-textarea { resize: vertical; min-height: 100px; }
        .form-actions { display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-7); padding-top: var(--space-5); border-top: 1px solid var(--neutral-100); }
        @media (max-width: 900px) {
          .edit-grid { grid-template-columns: 1fr; }
          .avatar-upload { position: static; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">TaiKaiX / User Profile / Edit</div>
            <h1>Edit Profile</h1>
          </div>
          <Link href="/profile" className="btn btn-ghost">
            <ArrowLeft size={16} /> Back to Profile
          </Link>
        </header>

        <div className="edit-grid" key={user?.uid || 'guest'}>
          {/* Sidebar / Avatar */}
          <aside className="avatar-upload">
            <div 
              className="avatar-preview"
              style={{ background: user?.photoURL ? `url(${user.photoURL}) center/cover` : `var(--neutral-100) url('https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'Felix'}') center/cover` }}
            >
              <div className="avatar-edit-btn">
                <Camera size={18} />
              </div>
            </div>
            <h3 style={{ marginBottom: '4px' }}>{user?.displayName || 'User Profile'}</h3>
            <button className="btn btn-ghost" style={{ marginTop: 'var(--space-4)', width: '100%', justifyContent: 'center', fontSize: '13px', border: '1px solid var(--neutral-300)' }}>
              Change Avatar
            </button>
          </aside>

          {/* Main Form */}
          <section className="form-card">
            <div className="form-section">
              <h2 className="form-section-title">Personal Information</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="input-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                  />
                </div>
                <div className="input-group">
                  <label>Email Address</label>
                  <input type="email" className="form-input" defaultValue={user?.email || ''} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="input-group">
                  <label>Phone Number</label>
                  <input type="tel" className="form-input" placeholder="+1 234-567-8900" />
                </div>
                <div className="input-group">
                  <label>Location</label>
                  <input type="text" className="form-input" placeholder="City, Country" />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h2 className="form-section-title">About Me</h2>
              <div className="input-group">
                <label>Academy / Organization</label>
                <input type="text" className="form-input" placeholder="Your Academy" />
              </div>
              <div className="input-group">
                <label>Bio & Experience</label>
                <textarea className="form-textarea" placeholder="Describe your experience in karate competitions..."></textarea>
              </div>
            </div>

            <div className="form-section">
              <h2 className="form-section-title">Preferences</h2>
              <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <input type="checkbox" id="email-notif" defaultChecked style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <label htmlFor="email-notif" style={{ marginBottom: 0, cursor: 'pointer' }}>Receive email notifications for competition updates</label>
              </div>
            </div>

            <div className="form-actions">
              <Link href="/profile" className="btn btn-secondary">Cancel</Link>
              <button 
                className="btn btn-primary" 
                onClick={handleSave} 
                style={saved ? { backgroundColor: 'var(--status-live)' } : {}}
              >
                {saving ? (
                  <><Loader2 size={16} className="spin" /> Saving...</>
                ) : saved ? (
                  <><Check size={16} /> Changes Saved!</>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
