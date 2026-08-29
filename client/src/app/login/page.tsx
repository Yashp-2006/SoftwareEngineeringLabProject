'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '@lib/firebase';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword } from 'firebase/auth';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'email' | 'pin'>('email');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [competitionsList, setCompetitionsList] = useState<any[]>([]);
  const [selectedCompId, setSelectedCompId] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [pin, setPin] = useState('');

  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [enrollName, setEnrollName] = useState('');
  const [enrollRole, setEnrollRole] = useState<'score' | 'attendance' | 'medal'>('score');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'pin') {
      const loadComps = async () => {
        const { db } = await import('@lib/firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'competitions'));
        setCompetitionsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      };
      loadComps();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedCompId) {
      const loadStaff = async () => {
        const { db } = await import('@lib/firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'competitions', selectedCompId, 'staff'));
        setStaffList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any).filter((s: any) => s.pin));
      };
      loadStaff();
    } else {
      setStaffList([]);
      setSelectedStaffId('');
    }
  }, [selectedCompId]);

  const checkEmailRosterAndRedirect = async (currentUser: any) => {
    if (!currentUser.email) return false;
    try {
      const { db } = await import('@lib/firebase');
      const { collection, getDocs, doc, updateDoc, getDoc } = await import('firebase/firestore');
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const globalRole = userDocSnap.data().role;
        if (globalRole === 'admin' || globalRole === 'guest_viewer') {
          window.location.href = '/competitions';
          return true;
        }
      }
      const urlCompId = new URLSearchParams(window.location.search).get('compId');
      let targetCompId = urlCompId;
      if (!targetCompId) {
        const compsSnap = await getDocs(collection(db, 'competitions'));
        for (const cDoc of compsSnap.docs) {
          const staffSnap = await getDocs(collection(db, 'competitions', cDoc.id, 'staff'));
          const matchedStaff = staffSnap.docs.find(s => s.data().email === currentUser.email);
          if (matchedStaff) { targetCompId = cDoc.id; break; }
        }
      }
      if (targetCompId) {
        const staffSnap = await getDocs(collection(db, 'competitions', targetCompId, 'staff'));
        const matchedStaff = staffSnap.docs.find(s => s.data().email === currentUser.email);
        if (matchedStaff) {
          const staffId = matchedStaff.id;
          const staffData = matchedStaff.data();
          if (staffData.approvalStatus !== 'approved') {
            const staffDocRef = doc(db, 'competitions', targetCompId, 'staff', staffId);
            await updateDoc(staffDocRef, { approvalStatus: 'pending', requestUserId: currentUser.uid, requestTimestamp: new Date().toISOString() });
            window.location.href = `/login/pending?compId=${targetCompId}&staffId=${staffId}`;
            return true;
          } else {
            let redirectUrl = `/competitions/${targetCompId}`;
            if (staffData.role === 'score' && staffData.assignedMats?.length > 0) redirectUrl = `/competitions/${targetCompId}/operator?mat=${staffData.assignedMats[0]}`;
            else if (staffData.role === 'attendance') redirectUrl = `/competitions/${targetCompId}/athletes`;
            else if (staffData.role === 'medal') redirectUrl = `/competitions/${targetCompId}/medals`;
            window.location.href = redirectUrl;
            return true;
          }
        }
      }
    } catch (e) { console.error('Failed to check email roster', e); }
    return false;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      const isStaffRedirected = await checkEmailRosterAndRedirect(userCredential.user);
      if (!isStaffRedirected) {
        const { db } = await import('@lib/firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'competitions'));
        setCompetitionsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setShowEnrollForm(true);
      }
    } catch (err: any) {
      const safeMessages: Record<string, string> = {
        'auth/user-not-found': 'Invalid email or password.',
        'auth/wrong-password': 'Invalid email or password.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
        'auth/network-request-failed': 'Network error. Check your connection.',
      };
      setError(safeMessages[err?.code] || 'Authentication failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleGoogleAuth = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const isStaffRedirected = await checkEmailRosterAndRedirect(userCredential.user);
      if (!isStaffRedirected) {
        const { db } = await import('@lib/firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'competitions'));
        setCompetitionsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setShowEnrollForm(true);
      }
    } catch (err: any) { setError(err.message || 'Google Sign-In failed'); }
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setError('');
    setLoading(true);
    try {
      const { db } = await import('@lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      const newStaffId = 'staff-' + Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'competitions', selectedCompId, 'staff', newStaffId), {
        id: newStaffId, name: enrollName.trim(), requestedRole: enrollRole, type: enrollRole,
        email: auth.currentUser.email || undefined, assignedMats: [], assignedCategories: [],
        assignedPools: [], approvalStatus: 'pending', requestUserId: auth.currentUser.uid,
        requestTimestamp: new Date().toISOString()
      });
      window.location.href = `/login/pending?compId=${selectedCompId}&staffId=${newStaffId}`;
    } catch (err: any) {
      setError(err.message || 'Failed to submit enrollment request.');
    } finally { setLoading(false); }
  };

  const handlePinAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const staffMember = staffList.find(s => s.id === selectedStaffId);
      if (!staffMember) throw new Error('Please select your profile.');
      if (staffMember.pin !== pin) throw new Error('Invalid PIN code.');
      const { signInAnonymously } = await import('firebase/auth');
      let user = auth.currentUser;
      if (!user || !user.isAnonymous) { const cred = await signInAnonymously(auth); user = cred.user; }
      const { db } = await import('@lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      const staffDocRef = doc(db, 'competitions', selectedCompId, 'staff', selectedStaffId);
      if (staffMember.approvalStatus === 'approved') {
        await updateDoc(staffDocRef, { userId: user!.uid, requestUserId: user!.uid, lastActiveAt: new Date().toISOString() });
        let redirectUrl = `/competitions/${selectedCompId}`;
        if (staffMember.role === 'score' && staffMember.assignedMats?.length > 0) redirectUrl = `/competitions/${selectedCompId}/operator?mat=${staffMember.assignedMats[0]}`;
        else if (staffMember.role === 'attendance') redirectUrl = `/competitions/${selectedCompId}/athletes`;
        else if (staffMember.role === 'medal') redirectUrl = `/competitions/${selectedCompId}/medals`;
        window.location.href = redirectUrl;
        return;
      }
      await updateDoc(staffDocRef, { approvalStatus: 'pending', requestUserId: user!.uid, requestTimestamp: new Date().toISOString() });
      window.location.href = `/login/pending?compId=${selectedCompId}&staffId=${selectedStaffId}`;
    } catch (err: any) {
      setError(err.message || 'PIN Authentication failed.');
    } finally { setLoading(false); }
  };

  // ─── shared input style ───────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', height: '48px',
    border: '1.5px solid var(--neutral-300)',
    borderRadius: '8px',
    padding: '0 14px',
    fontSize: '14px',
    fontFamily: 'var(--font-body)',
    color: 'var(--neutral-900)',
    background: 'var(--shiro)',
    outline: 'none',
    transition: 'border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, background: 'var(--shiro)', cursor: 'pointer' };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--neutral-600)',
    marginBottom: '8px',
  };

  const addFocusRing = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'var(--ao)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,77,181,0.12)';
  };
  const removeFocusRing = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'var(--neutral-300)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <>
      <style>{`
        /* ── Entry animations ── */
        @keyframes lp-slide-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .login-panel { animation: lp-slide-in 0.45s var(--ease-out) both; }

        /* Emil: form content crossfade on tab switch */
        @keyframes tab-content-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tab-content { animation: tab-content-in 200ms var(--ease-out) both; }

        /* Stagger form fields */
        .field-1 { animation: tab-content-in 220ms 40ms  var(--ease-out) both; }
        .field-2 { animation: tab-content-in 220ms 80ms  var(--ease-out) both; }
        .field-3 { animation: tab-content-in 220ms 120ms var(--ease-out) both; }
        .field-4 { animation: tab-content-in 220ms 160ms var(--ease-out) both; }

        /* Sliding tab underline container */
        .login-tabs {
          position: relative;
          display: flex;
          border-bottom: 1.5px solid var(--neutral-200);
          margin-bottom: 28px;
        }
        .login-tab {
          flex: 1; padding: 10px 8px;
          border: none; border-radius: 0;
          background: transparent;
          font-family: var(--font-body); font-size: 14px; font-weight: 600;
          cursor: pointer;
          color: var(--neutral-400);
          transition: color 180ms var(--ease-out);
          position: relative; z-index: 1;
        }
        .login-tab:hover { color: var(--neutral-700); }
        .login-tab.active { color: var(--kuro); }

        /* The sliding indicator — Emil: translate instead of border-per-tab */
        .login-tab-indicator {
          position: absolute;
          bottom: -1.5px; height: 2px;
          width: 50%;
          background: var(--aka);
          border-radius: 2px;
          transition: transform 240ms cubic-bezier(0.23, 1, 0.32, 1);
        }

        .login-divider {
          display: flex; align-items: center; gap: 12px;
          color: var(--neutral-400); font-size: 12px; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          margin: 20px 0;
        }
        .login-divider::before, .login-divider::after {
          content: ''; flex: 1; height: 1px; background: var(--neutral-200);
        }

        /* Emil: tactile press on all primary actions */
        .btn-primary:active { transform: scale(0.97) !important; filter: brightness(0.95); }
        .btn-primary { transition: transform 160ms var(--ease-out), box-shadow 200ms var(--ease-out), filter 120ms; }
        .btn-primary:hover { box-shadow: 0 4px 14px rgba(217,38,44,0.25); }

        .google-btn {
          width: 100%; height: 48px;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          background: var(--shiro); border: 1.5px solid var(--neutral-300);
          border-radius: 8px; cursor: pointer;
          font-family: var(--font-body); font-size: 14px; font-weight: 600;
          color: var(--neutral-700);
          transition: border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out), transform 160ms var(--ease-out);
          transform-origin: center;
        }
        .google-btn:hover { border-color: var(--neutral-500); box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
        .google-btn:active { transform: scale(0.97); }

        @media (prefers-reduced-motion: reduce) {
          .login-panel, .tab-content, .field-1, .field-2, .field-3, .field-4 { animation: none !important; opacity: 1 !important; transform: none !important; }
          .login-tab-indicator { transition: none; }
          .btn-primary:active { transform: none !important; }
        }

        @media (max-width: 768px) {
          .login-split { flex-direction: column !important; }
          .login-brand { display: none !important; }
          .login-form-side { max-width: 100% !important; min-height: 100vh !important; }
        }
      `}</style>

      <div className="login-split" style={{ display: 'flex', minHeight: '100vh' }}>

        {/* ── LEFT: Brand panel ── */}
        <div className="login-brand" style={{
          flex: '1 1 40%',
          background: 'var(--kuro)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Subtle red accent */}
          <div style={{
            position: 'absolute', top: '-80px', right: '-80px',
            width: '320px', height: '320px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(217,38,44,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: '-60px', left: '-40px',
            width: '240px', height: '240px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(26,77,181,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Logo */}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '0.06em', color: 'var(--shiro)', zIndex: 1 }}>
            TAIKAIX
          </div>

          {/* Hero text */}
          <div style={{ zIndex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(36px, 4vw, 56px)',
              lineHeight: 1.05,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              color: 'var(--shiro)',
              marginBottom: '20px',
              textWrap: 'balance',
            }}>
              Tournament<br />
              Operations<br />
              <span style={{ color: 'var(--aka)' }}>Console.</span>
            </div>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'oklch(68% 0.01 250)',
              lineHeight: 1.7,
              maxWidth: '300px',
            }}>
              Real-time brackets, mat displays, and athlete management — built for officials under pressure.
            </p>
          </div>

          {/* Bottom tag */}
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'oklch(45% 0.01 250)', zIndex: 1 }}>
            Flexible · Professional · Fast
          </div>
        </div>

        {/* ── RIGHT: Form panel ── */}
        <div className="login-form-side" style={{
          flex: '1 1 60%',
          maxWidth: '560px',
          background: 'var(--neutral-50)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 40px',
        }}>
          <div className="login-panel" style={{ width: '100%', maxWidth: '400px' }}>

            {/* Form header */}
            <div style={{ marginBottom: '32px' }}>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '32px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: 'var(--kuro)',
                marginBottom: '6px',
              }}>
                {showEnrollForm ? 'Request Access' : isSignUp ? 'Create Account' : 'Sign In'}
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--neutral-500)', lineHeight: 1.5 }}>
                {showEnrollForm
                  ? `Your email ${auth.currentUser?.email} is not on the roster. Request access below.`
                  : activeTab === 'pin'
                  ? 'Select your competition and enter your staff PIN.'
                  : 'Enter your credentials to access the workspace.'}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div role="alert" style={{
                padding: '12px 14px', borderRadius: '8px', marginBottom: '20px',
                background: 'var(--aka-light)', border: '1px solid var(--aka)',
                color: 'var(--aka)', fontSize: '13px', fontFamily: 'var(--font-body)',
                fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            {showEnrollForm ? (
              /* ── Enroll form ── */
              <form onSubmit={handleEnrollSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="enroll-comp" style={labelStyle}>Competition</label>
                  <select id="enroll-comp" value={selectedCompId} onChange={e => setSelectedCompId(e.target.value)}
                    style={selectStyle} onFocus={addFocusRing} onBlur={removeFocusRing} required>
                    <option value="">Select competition…</option>
                    {competitionsList.map(comp => <option key={comp.id} value={comp.id}>{comp.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="enroll-name" style={labelStyle}>Full Name</label>
                  <input id="enroll-name" type="text" value={enrollName} onChange={e => setEnrollName(e.target.value)}
                    placeholder="e.g. John Doe" style={inputStyle} onFocus={addFocusRing} onBlur={removeFocusRing} required />
                </div>
                <div>
                  <label htmlFor="enroll-role" style={labelStyle}>Requested Role</label>
                  <select id="enroll-role" value={enrollRole} onChange={e => setEnrollRole(e.target.value as any)}
                    style={selectStyle} onFocus={addFocusRing} onBlur={removeFocusRing} required>
                    <option value="score">Mat Operator</option>
                    <option value="attendance">Attendance Volunteer</option>
                    <option value="medal">Medal Distributor</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="button" onClick={() => { setShowEnrollForm(false); auth.signOut(); }}
                    className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={loading}>
                    {loading ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* ── Tabs with sliding indicator ── */}
                <div className="login-tabs">
                  <button type="button" className={`login-tab${activeTab === 'email' ? ' active' : ''}`}
                    onClick={() => { setActiveTab('email'); setError(''); }}>
                    Email Login
                  </button>
                  <button type="button" className={`login-tab${activeTab === 'pin' ? ' active' : ''}`}
                    onClick={() => { setActiveTab('pin'); setError(''); }}>
                    Quick PIN
                  </button>
                  {/* Emil: sliding underline — translate instead of toggling border */}
                  <div className="login-tab-indicator" style={{
                    transform: activeTab === 'email' ? 'translateX(0%)' : 'translateX(100%)',
                  }} />
                </div>

                {/* ── Form content — key triggers crossfade on tab switch ── */}
                <div
                  key={activeTab}
                  className="tab-content"
                  style={{ minHeight: '360px', display: 'flex', flexDirection: 'column' }}
                >
                  {activeTab === 'email' ? (
                    <>
                      <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="field-1">
                          <label htmlFor="login-email" style={labelStyle}>Email address</label>
                          <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="admin@taikaix.com" style={inputStyle} onFocus={addFocusRing} onBlur={removeFocusRing}
                            autoComplete="email" required />
                        </div>
                        <div className="field-2">
                          <label htmlFor="login-password" style={labelStyle}>Password</label>
                          <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••" style={inputStyle} onFocus={addFocusRing} onBlur={removeFocusRing}
                            autoComplete={isSignUp ? 'new-password' : 'current-password'} required />
                        </div>
                        <div className="field-3">
                          <button type="submit" className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center', height: '48px' }}
                            disabled={loading}>
                            {loading ? 'Processing…' : (isSignUp ? 'Create Account' : 'Sign In')}
                          </button>
                        </div>
                      </form>

                      <div className="login-divider field-4">or</div>

                      <button type="button" onClick={handleGoogleAuth} className="google-btn" aria-label="Sign in with Google"
                        style={{ animation: 'tab-content-in 220ms 200ms var(--ease-out) both' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                      </button>

                      <p style={{ textAlign: 'center', marginTop: '20px', fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--neutral-500)', animation: 'tab-content-in 220ms 240ms var(--ease-out) both' }}>
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                          style={{ background: 'none', border: 'none', color: 'var(--ao)', fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', fontSize: '13px' }}>
                          {isSignUp ? 'Sign In' : 'Sign Up'}
                        </button>
                      </p>
                    </>
                  ) : (
                    <form onSubmit={handlePinAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="field-1">
                        <label htmlFor="pin-comp" style={labelStyle}>Competition</label>
                        <select id="pin-comp" value={selectedCompId} onChange={e => setSelectedCompId(e.target.value)}
                          style={selectStyle} onFocus={addFocusRing} onBlur={removeFocusRing} required>
                          <option value="">Select competition…</option>
                          {competitionsList.map(comp => <option key={comp.id} value={comp.id}>{comp.name}</option>)}
                        </select>
                      </div>
                      <div className="field-2">
                        <label htmlFor="pin-staff" style={labelStyle}>Staff Profile</label>
                        <select id="pin-staff" value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)}
                          style={selectStyle} onFocus={addFocusRing} onBlur={removeFocusRing} required>
                          <option value="">Select your name…</option>
                          {staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>)}
                        </select>
                      </div>
                      <div className="field-3">
                        <label htmlFor="pin-code" style={labelStyle}>4-Digit PIN</label>
                        <input id="pin-code" type="password" maxLength={4} value={pin}
                          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          style={{ ...inputStyle, letterSpacing: '0.3em', textAlign: 'center', fontSize: '18px' }}
                          onFocus={addFocusRing} onBlur={removeFocusRing} required />
                      </div>
                      <div className="field-4">
                        <button type="submit" className="btn btn-primary"
                          style={{ width: '100%', justifyContent: 'center', height: '48px' }}
                          disabled={loading}>
                          {loading ? 'Verifying…' : 'Verify & Continue'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </>
            )}

            {/* Back link */}
            <div style={{ marginTop: '32px', textAlign: 'center' }}>
              <a href="/competitions" style={{
                fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--neutral-400)',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
                transition: 'color 160ms var(--ease-out)',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--neutral-700)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--neutral-400)')}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                Back to competitions
              </a>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
