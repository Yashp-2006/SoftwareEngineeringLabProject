'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@lib/firebase';
import { useSearchParams, useParams } from 'next/navigation';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { verifyPassword } from '@/lib/hash';

export default function PasswordGateway({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const rawMatId = searchParams.get('mat') || searchParams.get('matId'); // e.g. "mat-1", "mat-01", "1"
  
  // Normalize matId: e.g. "mat-01" -> "mat-1"
  const matNum = rawMatId ? parseInt(rawMatId.replace(/\D/g, '') || '1', 10) : null;
  const normalizedMatId = matNum !== null ? `mat-${matNum}` : null;
  const matId = normalizedMatId || rawMatId;

  const authKey = matId ? `auth_${id}_${matId}` : `auth_${id}`;

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(authKey) === 'true';
    }
    return false;
  });
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [targetName, setTargetName] = useState(() => {
    if (matNum !== null) return `Mat ${String(matNum).padStart(2, '0')}`;
    return 'Staff Portal';
  });

  const { user, role } = useAuth();

  useEffect(() => {
    // Check if session storage already has the password authorized
    const authed = sessionStorage.getItem(authKey);
    if (authed === 'true' || role === 'admin') {
      setIsAuthenticated(true);
    }

    // Fetch details
    const fetchTarget = async () => {
      try {
        if (matNum !== null) {
          setTargetName(`Mat ${String(matNum).padStart(2, '0')}`);
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
  }, [id, matId, matNum, authKey, user, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPassword.trim()) return;
    setError('');

    try {
      if (matId) {
        // Try normalized matId first (e.g. "mat-1"), then rawMatId if different
        let matSnap = await getDoc(doc(db, 'competitions', id, 'mats', matId));
        if (!matSnap.exists() && rawMatId && rawMatId !== matId) {
          matSnap = await getDoc(doc(db, 'competitions', id, 'mats', rawMatId));
        }

        if (matSnap.exists()) {
          const matData = matSnap.data();
          const rawPassword = matData.password;
          const displayPassword = matData.displayPassword;
          const actualPassword = displayPassword || rawPassword;
          const entered = inputPassword.trim();

          // Check if matches plain or hash
          let isMatch = false;
          if (actualPassword !== undefined && actualPassword !== null) {
            if (
              entered === String(actualPassword).trim() ||
              entered === String(rawPassword).trim() ||
              (displayPassword && entered === String(displayPassword).trim())
            ) {
              isMatch = true;
            } else if (rawPassword) {
              isMatch = await verifyPassword(entered, rawPassword);
            }
          }

          if (!actualPassword && !rawPassword) {
            setError('No password has been set for this mat yet. Configure it in the Mats management panel.');
            return;
          }

          if (isMatch) {
            // Authorize session immediately
            sessionStorage.setItem(authKey, 'true');
            setIsAuthenticated(true);
            setError('');

            // Best-effort staff & user profile update (do not block gateway if non-admin has no Firestore write permission)
            if (user && inputName.trim()) {
              try {
                const { setDoc } = await import('firebase/firestore');
                await setDoc(
                  doc(db, 'users', user.uid),
                  { displayName: inputName.trim() },
                  { merge: true }
                );
              } catch (uErr) {
                console.warn('Could not update user displayName:', uErr);
              }

              try {
                const { setDoc } = await import('firebase/firestore');
                await setDoc(
                  doc(db, 'competitions', id, 'staff', user.uid),
                  {
                    userId: user.uid,
                    name: inputName.trim(),
                    email: user.email || `${inputName.trim().toLowerCase().replace(/\s+/g, '.')}@taikaix.local`,
                    role: 'score',
                    approvalStatus: 'approved',
                    assignedCategories: [],
                    assignedMats: [String(matNum ?? matId.replace('mat-', ''))],
                  },
                  { merge: true }
                );
              } catch (sErr) {
                console.warn('Staff roster update skipped (non-admin):', sErr);
              }
            }
          } else {
            setError(`Incorrect password for ${targetName}.`);
          }
        } else {
          // If mat document does not exist, check if general competition password matches
          const compSnap = await getDoc(doc(db, 'competitions', id));
          if (compSnap.exists()) {
            const compData = compSnap.data();
            const compPass = compData.displayPassword || compData.password;
            const entered = inputPassword.trim();
            const isMatch = compPass && (entered === String(compPass).trim() || (await verifyPassword(entered, compPass)));
            if (isMatch) {
              sessionStorage.setItem(authKey, 'true');
              setIsAuthenticated(true);
              setError('');
              return;
            }
          }
          setError('Mat configuration not found for this competition.');
        }
      } else {
        const snap = await getDoc(doc(db, 'competitions', id));
        if (snap.exists()) {
          const compData = snap.data();
          const rawPassword = compData.password;
          const displayPassword = compData.displayPassword;
          const actualPassword = displayPassword || rawPassword;
          const entered = inputPassword.trim();

          let isMatch = false;
          if (actualPassword !== undefined && actualPassword !== null) {
            if (
              entered === String(actualPassword).trim() ||
              entered === String(rawPassword).trim() ||
              (displayPassword && entered === String(displayPassword).trim())
            ) {
              isMatch = true;
            } else if (rawPassword) {
              isMatch = await verifyPassword(entered, rawPassword);
            }
          }

          if (actualPassword && isMatch) {
            sessionStorage.setItem(authKey, 'true');
            setIsAuthenticated(true);
            setError('');

            if (user && inputName.trim()) {
              try {
                const { setDoc } = await import('firebase/firestore');
                await setDoc(
                  doc(db, 'users', user.uid),
                  { displayName: inputName.trim() },
                  { merge: true }
                );
              } catch (uErr) {
                console.warn('Could not update user displayName:', uErr);
              }

              try {
                const { setDoc } = await import('firebase/firestore');
                await setDoc(
                  doc(db, 'competitions', id, 'staff', user.uid),
                  {
                    userId: user.uid,
                    name: inputName.trim(),
                    email: user.email || `${inputName.trim().toLowerCase().replace(/\s+/g, '.')}@taikaix.local`,
                    role: 'guest_viewer',
                    approvalStatus: 'approved',
                  },
                  { merge: true }
                );
              } catch (sErr) {
                console.warn('Staff roster update skipped:', sErr);
              }
            }
          } else {
            setError('Incorrect password for this competition.');
          }
        } else {
          setError('Competition not found.');
        }
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
