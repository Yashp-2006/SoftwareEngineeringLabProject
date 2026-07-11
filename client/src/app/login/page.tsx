'use client';

import React, { useState } from 'react';
import { auth } from '@lib/firebase';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword } from 'firebase/auth';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      // Map Firebase error codes to safe generic messages (avoid user enumeration)
      const code = err?.code || '';
      const safeMessages: Record<string, string> = {
        'auth/user-not-found':      'Invalid email or password.',
        'auth/wrong-password':      'Invalid email or password.',
        'auth/invalid-credential':  'Invalid email or password.',
        'auth/email-already-in-use':'An account with this email already exists.',
        'auth/weak-password':       'Password must be at least 6 characters.',
        'auth/too-many-requests':   'Too many attempts. Try again later.',
        'auth/network-request-failed': 'Network error. Check your connection.',
      };
      setError(safeMessages[code] || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--neutral-50)' }}>
      <div style={{ background: 'var(--shiro)', padding: 'var(--space-8)', borderRadius: '16px', border: '1px solid var(--neutral-200)', boxShadow: '0 12px 40px rgba(0,0,0,0.06)', width: '100%', maxWidth: '420px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div className="nav-logo" style={{ color: 'var(--ao)', fontSize: '28px', marginBottom: 'var(--space-2)' }}>TAIKAIX</div>
          <h2 style={{ fontSize: '24px', color: 'var(--neutral-900)' }}>{isSignUp ? 'Create an Account' : 'Welcome Back'}</h2>
          <p className="text-small" style={{ color: 'var(--neutral-500)' }}>Sign in to manage your tournaments</p>
        </div>

        {error && (
          <div style={{ padding: '12px', borderRadius: '8px', background: 'color-mix(in oklch, var(--aka) 10%, var(--shiro))', border: '1px solid var(--aka)', color: 'var(--aka)', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--neutral-700)' }}>Email Address</label>
            <input 
              type="email" 
              className="input-field" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@taikaix.com"
              style={{ width: '100%', height: '44px', border: '1.5px solid var(--neutral-300)', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none' }}
              required 
            />
          </div>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--neutral-700)' }}>Password</label>
            <input 
              type="password" 
              className="input-field" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', height: '44px', border: '1.5px solid var(--neutral-300)', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none' }}
              required 
            />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '44px', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', color: 'var(--neutral-400)', fontSize: '13px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--neutral-200)' }}></div>
          <span style={{ padding: '0 12px' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--neutral-200)' }}></div>
        </div>

        <button 
          type="button"
          onClick={handleGoogleAuth} 
          className="btn btn-secondary" 
          style={{ width: '100%', height: '44px', justifyContent: 'center', border: '1.5px solid var(--neutral-300)' }}
        >
          <svg style={{ width: '18px', height: '18px', marginRight: '8px' }} viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--neutral-600)' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            type="button" 
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ background: 'none', border: 'none', color: 'var(--ao)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <a href="/competitions" style={{ fontSize: '13px', color: 'var(--neutral-500)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Return to App
          </a>
        </div>

      </div>
    </div>
  );
}
