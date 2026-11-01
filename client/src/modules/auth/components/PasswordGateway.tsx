'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@lib/firebase';
import { useSearchParams, useParams } from 'next/navigation';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import {
  normalizeMatKey,
  isMatSessionAuthorized,
  persistMatSessionAuthorization,
  canBypassMatGateway,
  verifyMatStationPassword,
} from '@/modules/auth/operator-auth';

export default function PasswordGateway({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const rawMatId = searchParams.get('mat') || searchParams.get('matId'); // e.g. "mat-1", "mat-01", "1"
  
  const { normalizedMatId, matNum, displayMatName } = normalizeMatKey(rawMatId);
  const targetMatParam = rawMatId || normalizedMatId;

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return isMatSessionAuthorized(id, targetMatParam, (k) => sessionStorage.getItem(k));
    }
    return false;
  });
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [targetName, setTargetName] = useState(() => {
    if (rawMatId || normalizedMatId) return displayMatName;
    return 'Staff Portal';
  });

  const { user, role } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if session storage already has any valid authorization key
    const isAuthedInSession = isMatSessionAuthorized(id, targetMatParam, (k) => sessionStorage.getItem(k));
    if (isAuthedInSession || canBypassMatGateway(role)) {
      setIsAuthenticated(true);
      return;
    }

    // Check if logged-in user is an approved staff member for this competition
    const checkStaffBypass = async () => {
      if (!user) return;
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const q = query(
          collection(db, 'competitions', id, 'staff'),
          where('userId', '==', user.uid)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const sData = snap.docs[0].data();
          if (sData.approvalStatus === 'approved' && canBypassMatGateway(role, sData.role)) {
            persistMatSessionAuthorization(id, targetMatParam, (k, v) => sessionStorage.setItem(k, v));
            setIsAuthenticated(true);
          }
        }
      } catch (err) {
        console.warn('Failed to verify staff bypass:', err);
      }
    };
    checkStaffBypass();

    // Fetch tournament/mat display details
    const fetchTarget = async () => {
      try {
        if (rawMatId || normalizedMatId) {
          setTargetName(displayMatName);
        } else {
          const snap = await getDoc(doc(db, 'competitions', id));
          if (snap.exists()) {
            setTargetName(snap.data().name || 'Competition Portal');
          }
        }
      } catch (err) {
        console.error('Failed to fetch target for password gateway', err);
      }
    };
    fetchTarget();
  }, [id, targetMatParam, normalizedMatId, rawMatId, displayMatName, user, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPassword.trim()) return;
    setError('');

    try {
      // 1. Fetch mat document (try normalized 'mat-1', raw '1', and padded 'mat-01')
      let matData: any = null;
      if (normalizedMatId) {
        let matSnap = await getDoc(doc(db, 'competitions', id, 'mats', normalizedMatId));
        if (!matSnap.exists() && rawMatId && rawMatId !== normalizedMatId) {
          matSnap = await getDoc(doc(db, 'competitions', id, 'mats', rawMatId));
        }
        if (!matSnap.exists() && matNum) {
          const paddedId = `mat-${String(matNum).padStart(2, '0')}`;
          matSnap = await getDoc(doc(db, 'competitions', id, 'mats', paddedId));
        }
        if (matSnap.exists()) {
          matData = matSnap.data();
        }
      }

      // 2. Fetch competition document
      let compData: any = null;
      const compSnap = await getDoc(doc(db, 'competitions', id));
      if (compSnap.exists()) {
        compData = compSnap.data();
      }

      // 3. Fetch staff list for competition (to allow staff PIN match)
      let assignedStaff: any[] = [];
      try {
        const staffSnap = await getDocs(collection(db, 'competitions', id, 'staff'));
        assignedStaff = staffSnap.docs.map((d) => d.data());
      } catch (err) {
        console.warn('Could not read staff roster for PIN check:', err);
      }

      // 4. Verify password with fallback hierarchy
      const verificationResult = await verifyMatStationPassword({
        enteredPassword: inputPassword,
        matData,
        compData,
        matNum,
        assignedStaff,
      });

      if (verificationResult.authorized) {
        // Authorize session across all key aliases
        persistMatSessionAuthorization(id, targetMatParam, (k, v) => sessionStorage.setItem(k, v));
        setIsAuthenticated(true);
        setError('');

        // Best-effort staff & user profile update if logged in
        if (user && inputName.trim()) {
          try {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(
              doc(db, 'users', user.uid),
              { displayName: inputName.trim() },
              { merge: true }
            );
            await setDoc(
              doc(db, 'competitions', id, 'staff', user.uid),
              {
                userId: user.uid,
                name: inputName.trim(),
                email: user.email || `${inputName.trim().toLowerCase().replace(/\s+/g, '.')}@taikaix.local`,
                role: 'score',
                approvalStatus: 'approved',
                assignedCategories: [],
                assignedMats: [String(matNum ?? 1)],
              },
              { merge: true }
            );
          } catch (uErr) {
            console.warn('Optional staff profile update skipped:', uErr);
          }
        }
      } else {
        setError(verificationResult.reason || `Incorrect password for ${targetName}.`);
      }
    } catch (err: any) {
      console.error('Password verification error:', err);
      setError(err?.message || 'An error occurred verifying the password.');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--neutral-100)',
      }}
    >
      <div
        style={{
          background: 'var(--shiro)',
          padding: 'var(--space-8)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '12px',
              background: 'rgba(217, 38, 44, 0.1)',
              borderRadius: '50%',
              color: 'var(--aka)',
              marginBottom: '16px',
            }}
          >
            <Lock size={24} />
          </div>
          <h2 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>Restricted Area</h2>
          <p style={{ color: 'var(--neutral-500)', fontSize: '14px', margin: 0 }}>
            Enter the staff password for <br />
            <strong>{targetName}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Your Name (Staff Name)"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              required
              style={{ borderColor: 'var(--neutral-300)' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                placeholder="Enter Password..."
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                style={{
                  paddingRight: '40px',
                  borderColor: error ? 'var(--aka)' : 'var(--neutral-300)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--neutral-500)',
                  cursor: 'pointer',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && (
              <p style={{ color: 'var(--aka)', fontSize: '12px', marginTop: '6px' }}>{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Unlock Portal
          </button>
        </form>
      </div>
    </div>
  );
}
