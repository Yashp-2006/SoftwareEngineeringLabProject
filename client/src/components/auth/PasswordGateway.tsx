'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@lib/firebase';
import { useSearchParams, useParams } from 'next/navigation';

export default function PasswordGateway({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const matId = searchParams.get('mat'); // e.g. "mat-1"
  const authKey = matId ? `auth_${id}_${matId}` : `auth_${id}`;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [targetName, setTargetName] = useState('Loading...');

  useEffect(() => {
    // Check if session storage already has the password authorized
    const authed = sessionStorage.getItem(authKey);
    if (authed === 'true') {
      setIsAuthenticated(true);
    }
    
    // Fetch details
    const fetchTarget = async () => {
      try {
        if (matId) {
          const matStr = matId.replace('mat-', '');
          setTargetName(`Mat ${matStr.padStart(2, '0')}`);
        } else {
          const snap = await getDoc(doc(db, 'competitions', id));
          if (snap.exists()) {
            setTargetName(snap.data().name);
          }
        }
      } catch (err) {
        console.error("Failed to fetch target for password gateway", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTarget();
  }, [id, matId, authKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPassword.trim()) return;
    
    try {
      if (matId) {
        const matSnap = await getDoc(doc(db, 'competitions', id, 'mats', matId));
        if (matSnap.exists()) {
          const actualPassword = matSnap.data().password;
          if (actualPassword === inputPassword) {
            sessionStorage.setItem(authKey, 'true');
            setIsAuthenticated(true);
            setError('');
          } else {
            setError(`Incorrect password for ${targetName}.`);
          }
        } else {
          setError('Mat configuration not found.');
        }
      } else {
        const snap = await getDoc(doc(db, 'competitions', id));
        if (snap.exists()) {
          const actualPassword = snap.data().password;
          if (actualPassword === inputPassword) {
            sessionStorage.setItem(authKey, 'true');
            setIsAuthenticated(true);
            setError('');
          } else {
            setError('Incorrect password for this competition.');
          }
        } else {
          setError('Competition not found.');
        }
      }
    } catch (err) {
      setError('An error occurred verifying the password.');
    }
  };

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Gateway...</div>;
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--neutral-100)' }}>
      <div style={{ background: 'var(--shiro)', padding: 'var(--space-8)', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(217, 38, 44, 0.1)', borderRadius: '50%', color: 'var(--aka)', marginBottom: '16px' }}>
            <Lock size={24} />
          </div>
          <h2 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>Restricted Area</h2>
          <p style={{ color: 'var(--neutral-500)', fontSize: '14px', margin: 0 }}>
            Enter the staff password for <br /><strong>{targetName}</strong>
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                className="input-field"
                placeholder="Enter Password..."
                value={inputPassword}
                onChange={e => setInputPassword(e.target.value)}
                style={{ paddingRight: '40px', borderColor: error ? 'var(--aka)' : 'var(--neutral-300)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--neutral-500)', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p style={{ color: 'var(--aka)', fontSize: '12px', marginTop: '6px' }}>{error}</p>}
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Unlock Portal
          </button>
        </form>
      </div>
    </div>
  );
}
