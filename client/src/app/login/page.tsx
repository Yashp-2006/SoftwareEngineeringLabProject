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

  // Enrollment states for unregistered email/google users
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
        setStaffList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any).filter(s => s.pin));
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
      
      // 1. Check if user is a global admin or guest_viewer
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
          if (matchedStaff) {
            targetCompId = cDoc.id;
            break;
          }
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
            await updateDoc(staffDocRef, {
              approvalStatus: 'pending',
              requestUserId: currentUser.uid,
              requestTimestamp: new Date().toISOString()
            });
            window.location.href = `/login/pending?compId=${targetCompId}&staffId=${staffId}`;
            return true;
          } else {
            // They are approved, redirect to their role-specific dashboard
            let redirectUrl = `/competitions/${targetCompId}`;
            if (staffData.role === 'score' && staffData.assignedMats && staffData.assignedMats.length > 0) {
              redirectUrl = `/competitions/${targetCompId}/operator?mat=${staffData.assignedMats[0]}`;
            } else if (staffData.role === 'attendance') {
              redirectUrl = `/competitions/${targetCompId}/athletes`;
            } else if (staffData.role === 'medal') {
              redirectUrl = `/competitions/${targetCompId}/medals`;
            }
            window.location.href = redirectUrl;
            return true;
          }
        }
      }
    } catch (e) {
      console.error('Failed to check email roster', e);
    }
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
      const userCredential = await signInWithPopup(auth, provider);
      const isStaffRedirected = await checkEmailRosterAndRedirect(userCredential.user);
      if (!isStaffRedirected) {
        const { db } = await import('@lib/firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'competitions'));
        setCompetitionsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setShowEnrollForm(true);
      }
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed');
    }
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
      const staffDocRef = doc(db, 'competitions', selectedCompId, 'staff', newStaffId);
      
      await setDoc(staffDocRef, {
        id: newStaffId,
        name: enrollName.trim(),
        role: enrollRole,
        type: enrollRole,
        email: auth.currentUser.email || undefined,
        assignedMats: [],
        assignedCategories: [],
        assignedPools: [],
        approvalStatus: 'pending',
        requestUserId: auth.currentUser.uid,
        requestTimestamp: new Date().toISOString()
      });
      
      window.location.href = `/login/pending?compId=${selectedCompId}&staffId=${newStaffId}`;
    } catch (err: any) {
      setError(err.message || 'Failed to submit enrollment request.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const staffMember = staffList.find(s => s.id === selectedStaffId);
      if (!staffMember) {
        throw new Error('Please select your profile.');
      }
      if (staffMember.pin !== pin) {
        throw new Error('Invalid PIN code.');
      }

      const { signInAnonymously } = await import('firebase/auth');
      const credential = await signInAnonymously(auth);
      const user = credential.user;

      const { db } = await import('@lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      const staffDocRef = doc(db, 'competitions', selectedCompId, 'staff', selectedStaffId);
      
      if (staffMember.approvalStatus === 'approved') {
        // Just update their active user mapping
        await updateDoc(staffDocRef, {
          userId: user.uid, // Fix: MUST update userId so checkStaff approves them
          requestUserId: user.uid,
          lastActiveAt: new Date().toISOString()
        });
        
        let redirectUrl = `/competitions/${selectedCompId}`;
        if (staffMember.role === 'score' && staffMember.assignedMats && staffMember.assignedMats.length > 0) {
          redirectUrl = `/competitions/${selectedCompId}/operator?mat=${staffMember.assignedMats[0]}`;
        } else if (staffMember.role === 'attendance') {
          redirectUrl = `/competitions/${selectedCompId}/athletes`;
        } else if (staffMember.role === 'medal') {
          redirectUrl = `/competitions/${selectedCompId}/medals`;
        }
        window.location.href = redirectUrl;
        return;
      }

      // Not approved yet, set to pending
      await updateDoc(staffDocRef, {
        approvalStatus: 'pending',
        requestUserId: user.uid,
        requestTimestamp: new Date().toISOString()
      });

      window.location.href = `/login/pending?compId=${selectedCompId}&staffId=${selectedStaffId}`;
    } catch (err: any) {
      setError(err.message || 'PIN Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--neutral-50)' }}>
      <div style={{ background: 'var(--shiro)', padding: 'var(--space-8)', borderRadius: '16px', border: '1px solid var(--neutral-200)', boxShadow: '0 12px 40px rgba(0,0,0,0.06)', width: '100%', maxWidth: '420px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div className="nav-logo" style={{ color: 'var(--ao)', fontSize: '28px', marginBottom: 'var(--space-2)' }}>TAIKAIX</div>
          <h2 style={{ fontSize: '24px', color: 'var(--neutral-900)' }}>Welcome to TaikaiX</h2>
          <p className="text-small" style={{ color: 'var(--neutral-500)' }}>Sign in to access your tournament workspace</p>
        </div>

        {showEnrollForm ? (
          <form onSubmit={handleEnrollSubmit}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--neutral-900)', fontWeight: 700 }}>Roster Enrollment Request</h3>
              <p style={{ fontSize: '13px', color: 'var(--neutral-500)', marginTop: '4px', lineHeight: 1.5 }}>
                Your email <strong>{auth.currentUser?.email}</strong> is not registered. Request access below.
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--neutral-700)' }}>Select Competition</label>
              <select
                value={selectedCompId}
                onChange={e => setSelectedCompId(e.target.value)}
                style={{ width: '100%', height: '44px', border: '1.5px solid var(--neutral-300)', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' }}
                required
              >
                <option value="">Select Competition</option>
                {competitionsList.map(comp => (
                  <option key={comp.id} value={comp.id}>{comp.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--neutral-700)' }}>Full Name</label>
              <input
                type="text"
                value={enrollName}
                onChange={e => setEnrollName(e.target.value)}
                placeholder="e.g. John Doe"
                style={{ width: '100%', height: '44px', border: '1.5px solid var(--neutral-300)', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--neutral-700)' }}>Requested Role</label>
              <select
                value={enrollRole}
                onChange={e => setEnrollRole(e.target.value as any)}
                style={{ width: '100%', height: '44px', border: '1.5px solid var(--neutral-300)', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' }}
                required
              >
                <option value="score">Mat Operator</option>
                <option value="attendance">Attendance Volunteer</option>
                <option value="medal">Medal Distributor</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => { setShowEnrollForm(false); auth.signOut(); }}
                className="btn btn-secondary"
                style={{ flex: 1, height: '44px', justifyContent: 'center' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, height: '44px', justifyContent: 'center' }}
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Tab selection */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--neutral-200)', marginBottom: '24px', paddingBottom: '8px' }}>
              <button
                type="button"
                onClick={() => { setActiveTab('email'); setError(''); }}
                style={{ flex: 1, padding: '8px', border: 'none', background: activeTab === 'email' ? 'var(--ao)' : 'transparent', color: activeTab === 'email' ? '#fff' : 'var(--neutral-600)', fontWeight: 600, borderRadius: '6px', cursor: 'pointer' }}
              >
                Email Login
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('pin'); setError(''); }}
                style={{ flex: 1, padding: '8px', border: 'none', background: activeTab === 'pin' ? 'var(--ao)' : 'transparent', color: activeTab === 'pin' ? '#fff' : 'var(--neutral-600)', fontWeight: 600, borderRadius: '6px', cursor: 'pointer' }}
              >
                Quick PIN Login
              </button>
            </div>

            {error && (
              <div style={{ padding: '12px', borderRadius: '8px', background: 'color-mix(in oklch, var(--aka) 10%, var(--shiro))', border: '1px solid var(--aka)', color: 'var(--aka)', fontSize: '13px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            {activeTab === 'email' ? (
              <>
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
              </>
            ) : (
              <form onSubmit={handlePinAuth}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--neutral-700)' }}>Competition</label>
                  <select
                    value={selectedCompId}
                    onChange={e => setSelectedCompId(e.target.value)}
                    style={{ width: '100%', height: '44px', border: '1.5px solid var(--neutral-300)', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' }}
                    required
                  >
                    <option value="">Select Competition</option>
                    {competitionsList.map(comp => (
                      <option key={comp.id} value={comp.id}>{comp.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--neutral-700)' }}>Staff Profile Name</label>
                  <select
                    value={selectedStaffId}
                    onChange={e => setSelectedStaffId(e.target.value)}
                    style={{ width: '100%', height: '44px', border: '1.5px solid var(--neutral-300)', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' }}
                    required
                  >
                    <option value="">Select Profile</option>
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--neutral-700)' }}>4-Digit PIN</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    style={{ width: '100%', height: '44px', border: '1.5px solid var(--neutral-300)', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none' }}
                    required 
                  />
                </div>
                
                <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '44px', justifyContent: 'center' }} disabled={loading}>
                  {loading ? 'Verifying PIN...' : 'Verify & Request Approval'}
                </button>
              </form>
            )}
          </>
        )}

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
