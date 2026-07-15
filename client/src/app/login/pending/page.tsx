'use client';

import React, { useEffect, useState } from 'react';
import { auth } from '@lib/firebase';
import { signOut } from 'firebase/auth';
import { Loader2, ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react';

export default function PendingApprovalPage() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'declined' | null>('pending');
  const [staffInfo, setStaffInfo] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let unsubscribe = () => {};
    const setupListener = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const compId = urlParams.get('compId');
      const staffId = urlParams.get('staffId');

      if (!compId || !staffId) {
        setError('Missing tournament or staff configuration details.');
        return;
      }

      try {
        const { db } = await import('@lib/firebase');
        const { doc, onSnapshot } = await import('firebase/firestore');

        const staffDocRef = doc(db, 'competitions', compId, 'staff', staffId);
        unsubscribe = onSnapshot(staffDocRef, (snap) => {
          if (!snap.exists()) {
            setError('Staff profile not found in roster.');
            return;
          }
          const data = snap.data();
          if (data) {
            setStaffInfo(data);
            setStatus(data.approvalStatus || 'pending');

            if (data.approvalStatus === 'approved') {
              let redirectUrl = `/competitions/${compId}`;
              if (data.role === 'score' && data.assignedMats && data.assignedMats.length > 0) {
                redirectUrl = `/competitions/${compId}/operator?mat=${data.assignedMats[0]}`;
              } else if (data.role === 'attendance') {
                redirectUrl = `/competitions/${compId}/athletes`;
              } else if (data.role === 'medal') {
                redirectUrl = `/competitions/${compId}/medals`;
              }
              
              setTimeout(() => {
                window.location.href = redirectUrl;
              }, 1500);
            }
          }
        }, (err) => {
          console.error(err);
          setError('Failed to subscribe to approval status.');
        });
      } catch (e) {
        console.error(e);
        setError('Database connection error.');
      }
    };

    setupListener();
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      window.location.href = '/login';
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--neutral-50)', padding: '24px' }}>
      <div style={{ background: 'var(--shiro)', padding: '40px', borderRadius: '16px', border: '1px solid var(--neutral-200)', boxShadow: '0 12px 40px rgba(0,0,0,0.06)', width: '100%', maxWidth: '480px', textAlign: 'center' }}>
        <div className="nav-logo" style={{ color: 'var(--ao)', fontSize: '28px', marginBottom: '24px', letterSpacing: '0.1em', fontWeight: 800 }}>TAIKAIX</div>

        {error ? (
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(217,38,44,0.1)', color: 'var(--aka)', marginBottom: '24px' }}>
              <ShieldAlert size={32} />
            </div>
            <h2 style={{ fontSize: '20px', color: 'var(--neutral-900)', marginBottom: '12px', fontWeight: 700 }}>Configuration Error</h2>
            <p style={{ color: 'var(--neutral-500)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>{error}</p>
          </div>
        ) : status === 'declined' ? (
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(217,38,44,0.1)', color: 'var(--aka)', marginBottom: '24px' }}>
              <ShieldAlert size={32} />
            </div>
            <h2 style={{ fontSize: '20px', color: 'var(--neutral-900)', marginBottom: '12px', fontWeight: 700 }}>Access Declined</h2>
            <p style={{ color: 'var(--neutral-500)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              Your request to enter as <strong>{staffInfo?.name || 'Staff Member'}</strong> has been declined by the administrator.
            </p>
          </div>
        ) : status === 'approved' ? (
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', color: '#10b981', marginBottom: '24px' }}>
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: '20px', color: 'var(--neutral-900)', marginBottom: '12px', fontWeight: 700 }}>Access Approved!</h2>
            <p style={{ color: 'var(--neutral-500)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              Redirecting you to your assigned workspace...
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Loader2 className="animate-spin" size={24} style={{ color: 'var(--ao)' }} />
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: 'var(--ao)', marginBottom: '24px', position: 'relative' }}>
              <Loader2 className="animate-spin" size={32} />
            </div>
            <h2 style={{ fontSize: '20px', color: 'var(--neutral-900)', marginBottom: '12px', fontWeight: 700 }}>Waiting for Admin Approval</h2>
            <p style={{ color: 'var(--neutral-500)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              Hello <strong>{staffInfo?.name || 'Staff Member'}</strong>. Your request to log in is pending administrator verification. Please keep this screen open.
            </p>
            <div style={{ background: 'var(--neutral-50)', padding: '16px', borderRadius: '12px', border: '1px solid var(--neutral-200)', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ fontSize: '12px', color: 'var(--neutral-400)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Your Profile Info</div>
              <div style={{ fontSize: '14px', color: 'var(--neutral-700)', marginBottom: '4px' }}><strong>Role:</strong> {staffInfo?.role === 'score' ? 'Mat Operator' : staffInfo?.role === 'attendance' ? 'Attendance Volunteer' : 'Medal Distributor'}</div>
              <div style={{ fontSize: '14px', color: 'var(--neutral-700)' }}><strong>Assigned Task:</strong> {staffInfo?.role === 'score' ? (staffInfo?.assignedMats?.[0] || 'Unassigned Mat') : staffInfo?.role === 'attendance' ? (staffInfo?.assignedCategories?.[0] || 'Unassigned Category') : (staffInfo?.assignedPools?.[0] || 'Unassigned Pool')}</div>
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--neutral-200)', paddingTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <button onClick={handleSignOut} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: '1.5px solid var(--neutral-300)', borderRadius: '8px', background: '#fff', color: 'var(--neutral-600)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <LogOut size={16} /> Sign Out & Login Again
          </button>
        </div>

      </div>
    </div>
  );
}
