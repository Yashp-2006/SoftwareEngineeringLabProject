'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { Award, Loader2, ArrowLeft, Lock, Radio } from 'lucide-react';
import PageSkeleton from '@/modules/core/layout/PageSkeleton';
import { toast } from 'react-hot-toast';
import { rtdb, db } from '@lib/firebase';
import { ref, onValue, off, update } from 'firebase/database';

// ─── Flag SVG Component ─────────────────────────────────────────────────────────
const FlagIcon = ({ color, size = 120 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12z" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="4" y1="22" x2="4" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// Standardize mat strings: "MAT 01", "mat-1", "1", "MAT 1" → { matId: "mat-1", matLabel: "MAT 01", matNum: 1 }
function parseMatInfo(raw: string): { matId: string; matLabel: string; matNum: number } {
  const num = parseInt(raw.replace(/\D/g, '') || '1', 10);
  return {
    matId: `mat-${num}`,
    matLabel: `MAT ${String(num).padStart(2, '0')}`,
    matNum: num,
  };
}

function JudgePanelInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const { user, role, loading: authLoading } = useAuth();

  // URL query params: ?mat=mat-1 & ?judge=1 / ?seat=1
  const matQuery = searchParams.get('mat') || searchParams.get('matId');
  const judgeQuery = searchParams.get('judge') || searchParams.get('seat') || searchParams.get('position');

  // Auto-detected mat+seat from staff assignment
  const [assignedMatId, setAssignedMatId] = useState<string | null>(null);
  const [assignedJudgeIndex, setAssignedJudgeIndex] = useState<number | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  // Available mats count (dynamically loaded from competition doc, default 8)
  const [availableMatsCount, setAvailableMatsCount] = useState<number>(8);

  // Display labels for mat selection
  const [matLabel, setMatLabel] = useState<string | null>(() => {
    if (matQuery) return parseMatInfo(matQuery).matLabel;
    return null;
  });
  const matId = matLabel ? parseMatInfo(matLabel).matId : null;
  const [judgeIndex, setJudgeIndex] = useState<number | null>(() => {
    if (judgeQuery) {
      const parsed = parseInt(judgeQuery, 10);
      if (!isNaN(parsed)) return parsed >= 1 ? parsed - 1 : 0;
    }
    return null;
  });

  // Fetch competition mats count
  useEffect(() => {
    if (!id) return;
    const fetchComp = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'competitions', id));
        if (snap.exists()) {
          const cData = snap.data();
          const count = cData.numberOfMats || cData.matsCount || (Array.isArray(cData.mats) ? cData.mats.length : null);
          if (count && typeof count === 'number' && count > 0) {
            setAvailableMatsCount(Math.min(Math.max(count, 1), 16));
          }
        }
      } catch (e) {
        console.warn('Could not load competition mat count', e);
      }
    };
    fetchComp();
  }, [id]);

  // Load staff assignment (by user.uid or user.email, reading assignedMats, reassignedToMat, and matId)
  useEffect(() => {
    if (!user) return;
    setAssignmentLoading(true);
    let unsubStaff: (() => void) | null = null;

    const loadStaff = async () => {
      try {
        const { collection, query, where, getDocs, doc, onSnapshot } = await import('firebase/firestore');

        // 1. Match by UID
        let q = query(
          collection(db, 'competitions', id, 'staff'),
          where('userId', '==', user.uid)
        );
        let snap = await getDocs(q);

        // 2. Fallback to match by email
        if (snap.empty && user.email) {
          q = query(
            collection(db, 'competitions', id, 'staff'),
            where('email', '==', user.email)
          );
          snap = await getDocs(q);
        }

        if (!snap.empty) {
          const staffDoc = snap.docs[0];
          const applyAssignment = (data: any) => {
            const rawMat = data.reassignedToMat || (data.assignedMats && data.assignedMats.length > 0 ? data.assignedMats[0] : null) || data.matId;
            if (rawMat) {
              const { matId: pId, matLabel: pLabel } = parseMatInfo(String(rawMat));
              setAssignedMatId(pId);
              setMatLabel((curr) => curr || pLabel);
            }

            const jIdx = typeof data.judgeIndex === 'number' ? data.judgeIndex : (typeof data.seatIndex === 'number' ? data.seatIndex : null);
            if (jIdx !== null) {
              setAssignedJudgeIndex(jIdx);
              setJudgeIndex((curr) => (curr === null ? jIdx : curr));
            }
          };

          applyAssignment(staffDoc.data());

          // Listen for live reassignment
          unsubStaff = onSnapshot(doc(db, 'competitions', id, 'staff', staffDoc.id), (docSnap) => {
            if (docSnap.exists()) {
              applyAssignment(docSnap.data());
            }
          });
        }
      } catch (err) {
        console.error('Failed to load judge assignment', err);
      } finally {
        setAssignmentLoading(false);
      }
    };

    loadStaff();

    return () => {
      if (unsubStaff) unsubStaff();
    };
  }, [user, id]);

  const [liveData, setLiveData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rtdbReady, setRtdbReady] = useState(false);

  // 5-second countdown state
  const [voteCountdown, setVoteCountdown] = useState<number | null>(null);
  const [pendingVote, setPendingVote] = useState<'aka' | 'ao' | null>(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);

  // Dynamic judge count from live match data
  const configuredJudgeCount = liveData?.numberOfJudges ?? null;

  // Track matchId changes to reset voting state for next bout
  const currentMatchId = liveData?.matchId;
  const [lastMatchId, setLastMatchId] = useState<string | null>(null);
  if (currentMatchId && currentMatchId !== lastMatchId) {
    setLastMatchId(currentMatchId);
    setVoteCountdown(null);
    setPendingVote(null);
    setVoteSubmitted(false);
  }

  const [prevMatId, setPrevMatId] = useState<string | null>(null);
  if (matId !== prevMatId) {
    setPrevMatId(matId);
    setLiveData(null);
    setRtdbReady(false);
    if (matId) setLoading(true);
  }

  // Listen to RTDB whenever matId changes
  useEffect(() => {
    if (!matId) return;

    let unsub: (() => void) | undefined;
    setLoading(true);
    setRtdbReady(false);

    // Safety timeout: never hang forever on "Connecting to live mat..."
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setRtdbReady(true);
    }, 2500);

    try {
      const r = ref(rtdb, `live_scores/${id}/mats/${matId}`);
      const handler = onValue(
        r,
        (snap) => {
          clearTimeout(safetyTimer);
          if (snap.exists()) {
            setLiveData(snap.val());
          } else {
            setLiveData(null);
          }
          setLoading(false);
          setRtdbReady(true);
        },
        (error) => {
          clearTimeout(safetyTimer);
          console.error('Failed to listen to live scores', error);
          setLoading(false);
          setRtdbReady(true);
        }
      );
      unsub = () => off(r, 'value', handler);
    } catch (err) {
      clearTimeout(safetyTimer);
      console.error('Failed to setup live scores listener', err);
      setLoading(false);
      setRtdbReady(true);
    }

    return () => {
      clearTimeout(safetyTimer);
      if (unsub) unsub();
    };
  }, [id, matId]);

  // 5-second countdown timer when bout finishes
  useEffect(() => {
    if (liveData?.boutFinished && voteCountdown === null && !voteSubmitted) {
      setVoteCountdown(5);
    }
  }, [liveData?.boutFinished, voteCountdown, voteSubmitted]);

  useEffect(() => {
    if (voteCountdown === null || voteCountdown <= 0) return;
    const timer = setTimeout(() => {
      setVoteCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [voteCountdown]);

  const submitVote = async (vote: 'aka' | 'ao') => {
    if (!matId || judgeIndex === null) return;
    try {
      const r = ref(rtdb, `live_scores/${id}/mats/${matId}/kataScores`);
      const patch: any = {};
      if (vote === 'aka') {
        patch[`aka/${judgeIndex}`] = 1;
        patch[`ao/${judgeIndex}`] = 0;
      } else {
        patch[`aka/${judgeIndex}`] = 0;
        patch[`ao/${judgeIndex}`] = 1;
      }

      await update(r, patch);
      toast.success(`Vote for ${vote.toUpperCase()} submitted!`);
    } catch (err) {
      console.error('Vote submission failed', err);
      toast.error('Failed to submit vote. Check connection.');
    }
  };

  // When countdown hits 0, submit pending vote
  useEffect(() => {
    if (voteCountdown === 0 && pendingVote && !voteSubmitted) {
      submitVote(pendingVote);
      setVoteSubmitted(true);
    }
  }, [voteCountdown, pendingVote, voteSubmitted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFlagVote = async (vote: 'aka' | 'ao') => {
    if (!matId || judgeIndex === null) {
      toast.error('Please select your mat and seat first.');
      return;
    }

    // If bout is finished, use countdown lock mechanism
    if (liveData?.boutFinished) {
      if (voteSubmitted) {
        toast.error('Vote already submitted.');
        return;
      }
      setPendingVote(vote);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      return;
    }

    // Normal voting during match
    try {
      const r = ref(rtdb, `live_scores/${id}/mats/${matId}/kataScores`);
      const patch: any = {};
      if (vote === 'aka') {
        patch[`aka/${judgeIndex}`] = 1;
        patch[`ao/${judgeIndex}`] = 0;
      } else {
        patch[`aka/${judgeIndex}`] = 0;
        patch[`ao/${judgeIndex}`] = 1;
      }

      await update(r, patch);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (err) {
      console.error('Vote failed', err);
      toast.error('Failed to submit vote. Check connection.');
    }
  };

  // ─── Authentication Guard ───────────────────────────────────────────
  if (authLoading) {
    return <PageSkeleton />;
  }

  if (!user) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--neutral-900)', color: 'var(--shiro)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '32px' }}>
        <Lock size={48} color="#ef4444" />
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>Authentication Required</h1>
        <p style={{ fontSize: '16px', color: 'var(--neutral-400)', textAlign: 'center', maxWidth: '400px', margin: 0 }}>
          The Judge Panel requires authentication. Please sign in with your judge account to access the voting interface.
        </p>
        <Link href={`/login?compId=${id}`} className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '15px' }}>
          Sign In
        </Link>
      </main>
    );
  }

  if (assignmentLoading && !matLabel) {
    return <PageSkeleton />;
  }

  // ─── Mat & Judge Selection Screen ──────────────────────────────────
  const matLabels = Array.from({ length: availableMatsCount }, (_, i) => `MAT ${String(i + 1).padStart(2, '0')}`);
  const judgeCount = configuredJudgeCount || 7;
  const judges = Array.from({ length: judgeCount }, (_, i) => i);

  if (!matLabel || judgeIndex === null) {
    return (
      <main className="container" style={{ maxWidth: '640px', paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
        <div className="card" style={{ padding: '28px', borderRadius: '16px', border: '1px solid var(--neutral-200)', background: 'var(--bg-surface)' }}>
          <div className="flex-between" style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0' }}>Judge Assignment</h1>
              <p className="text-small" style={{ margin: 0, color: 'var(--neutral-500)' }}>Select your assigned Mat and Position to connect live.</p>
            </div>
            <Link href={`/competitions/${id}`} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} /> Back
            </Link>
          </div>

          {!assignedMatId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '10px', marginBottom: '20px' }}>
              <Radio size={18} color="#eab308" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: 'var(--neutral-700)' }}>
                No automatic mat assignment linked to your profile. Select your mat and seat manually below to start judging.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* Step 1: Select Mat */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                1. Select Mat
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {matLabels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn ${matLabel === m ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setMatLabel(m);
                      setJudgeIndex(null);
                      setVoteCountdown(null);
                      setPendingVote(null);
                      setVoteSubmitted(false);
                    }}
                    style={{ padding: '12px 8px', fontSize: '13px', fontWeight: 700 }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Select Judge Position */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                2. Select Judge Position
              </label>

              {!matLabel ? (
                <p style={{ fontSize: '12px', color: 'var(--neutral-500)', marginBottom: '8px' }}>
                  Select a mat above to see available judge positions.
                </p>
              ) : loading && !rtdbReady ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--neutral-500)', fontSize: '13px' }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Checking mat connection...
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--neutral-500)', marginBottom: '8px' }}>
                  {configuredJudgeCount
                    ? `Active match on ${matLabel} has ${configuredJudgeCount} judges configured.`
                    : `Connected to ${matLabel}. Showing all ${judgeCount} judge seats.`}
                </p>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(judgeCount, 7)}, 1fr)`,
                  gap: '8px',
                  opacity: !matLabel ? 0.4 : 1,
                  pointerEvents: !matLabel ? 'none' : 'auto',
                }}
              >
                {judges.map((j) => (
                  <button
                    key={j}
                    type="button"
                    className={`btn ${judgeIndex === j ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setJudgeIndex(j)}
                    style={{ padding: '12px 0', fontSize: '14px', fontWeight: 800 }}
                  >
                    J{j + 1}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--neutral-50)', borderRadius: '12px', border: '1px solid var(--neutral-200)' }}>
              <p style={{ fontSize: '13px', color: 'var(--neutral-600)', margin: 0 }}>
                <strong>Note:</strong> Ensure your seat selection matches the assignment given to you by the tournament director. Your votes are transmitted live to the scoreboard.
              </p>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  // ─── Active Judge View ─────────────────────────────────────────────
  let myVote: 'aka' | 'ao' | 'tie' | null = null;
  if (liveData?.kataScores) {
    const akaScore = liveData.kataScores.aka?.[judgeIndex];
    const aoScore = liveData.kataScores.ao?.[judgeIndex];
    if (akaScore > aoScore) myVote = 'aka';
    else if (aoScore > akaScore) myVote = 'ao';
    else if (akaScore === 0 && aoScore === 0) myVote = 'tie';
  }

  const akaName = liveData?.akaName || 'AKA';
  const aoName = liveData?.aoName || 'AO';

  return (
    <main style={{ minHeight: '100vh', background: 'var(--neutral-900)', color: 'var(--shiro)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Award size={24} color="#3b82f6" />
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.05em' }}>LIVE JUDGE PANEL</div>
            <div style={{ fontSize: '12px', color: 'var(--neutral-400)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span>{matLabel} · Judge {judgeIndex + 1}</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: rtdbReady ? (liveData ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)') : 'rgba(239,68,68,0.15)',
                  color: rtdbReady ? (liveData ? '#4ade80' : '#facc15') : '#f87171',
                  fontWeight: 700,
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                {loading && !rtdbReady ? 'Connecting...' : liveData ? 'Live Connected' : 'Mat Standby'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setMatLabel(null);
            setJudgeIndex(null);
            setVoteCountdown(null);
            setPendingVote(null);
            setVoteSubmitted(false);
            setLiveData(null);
            setRtdbReady(false);
          }}
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--shiro)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Change Mat / Seat
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflow: 'hidden' }}>
        {loading && !rtdbReady ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '16px', color: 'var(--neutral-400)' }}>
            <Loader2 size={40} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '16px', fontWeight: 600 }}>Connecting to {matLabel}...</span>
          </div>
        ) : (
          <>
            {/* Competitor names banner + kata info */}
            {(liveData?.matchId || liveData?.akaName || liveData?.aoName) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--aka)' }} />
                    <span style={{ fontWeight: 800, fontSize: '15px' }}>{akaName}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--neutral-500)', fontWeight: 700, letterSpacing: '0.1em' }}>VS</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '15px' }}>{aoName}</span>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--ao)' }} />
                  </div>
                </div>

                {liveData?.isKata && (liveData?.selectedKata?.aka || liveData?.selectedKata?.ao) && (
                  <div style={{ display: 'flex', gap: '8px', padding: '10px 16px', background: 'rgba(59,130,246,0.08)', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.2)', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    {liveData.selectedKata?.aka && (
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(217,38,44,0.9)' }}>
                        AKA: <span style={{ fontWeight: 800 }}>#{liveData.selectedKata.aka.number} {liveData.selectedKata.aka.name}</span>
                      </div>
                    )}
                    {liveData.selectedKata?.ao && (
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(96,165,250,1)' }}>
                        AO: <span style={{ fontWeight: 800 }}>#{liveData.selectedKata.ao.number} {liveData.selectedKata.ao.name}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* No active match notice */}
            {!liveData && rtdbReady && (
              <div style={{ textAlign: 'center', padding: '20px', marginBottom: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--neutral-400)' }}>Connected to {matLabel} (Standby)</div>
                <div style={{ fontSize: '12px', color: 'var(--neutral-500)', marginTop: '4px' }}>Waiting for mat operator to start next bout. You can vote as soon as the match begins.</div>
              </div>
            )}

            {/* 5-second countdown overlay */}
            {liveData?.boutFinished && voteCountdown !== null && voteCountdown > 0 && (
              <div style={{ textAlign: 'center', padding: '16px', marginBottom: '16px', background: 'rgba(245,158,11,0.15)', border: '2px solid #f59e0b', borderRadius: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Cast Your Vote Now
                </div>
                <div style={{ fontSize: '48px', fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                  {voteCountdown}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--neutral-400)', marginTop: '4px' }}>
                  {pendingVote ? `Vote locked: ${pendingVote.toUpperCase()}` : 'Tap AKA or AO to cast your vote'}
                </div>
              </div>
            )}

            <div className="judge-buttons" style={{ flex: 1, display: 'flex', gap: '24px' }}>
              <style>{`
                .judge-buttons { flex-direction: column; }
                @media (min-width: 768px) { .judge-buttons { flex-direction: row; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
              `}</style>
              <button
                type="button"
                onClick={() => handleFlagVote('aka')}
                disabled={voteSubmitted}
                style={{
                  flex: 1,
                  borderRadius: '24px',
                  border: 'none',
                  background: (myVote === 'aka' || pendingVote === 'aka') ? 'var(--aka)' : 'rgba(217,38,44,0.1)',
                  borderWidth: (myVote === 'aka' || pendingVote === 'aka') ? '0' : '2px',
                  borderStyle: 'solid',
                  borderColor: 'var(--aka)',
                  color: (myVote === 'aka' || pendingVote === 'aka') ? '#fff' : 'var(--aka)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '24px',
                  cursor: voteSubmitted ? 'not-allowed' : 'pointer',
                  opacity: voteSubmitted ? 0.5 : 1,
                  transition: 'all 0.2s',
                  boxShadow: (myVote === 'aka' || pendingVote === 'aka') ? '0 12px 48px rgba(217,38,44,0.4)' : 'none',
                }}
              >
                <FlagIcon color={(myVote === 'aka' || pendingVote === 'aka') ? '#fff' : 'var(--aka)'} />
                <div style={{ fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AKA</div>
                <div style={{ fontSize: '14px', fontWeight: 600, opacity: 0.8 }}>{akaName}</div>
              </button>
              <button
                type="button"
                onClick={() => handleFlagVote('ao')}
                disabled={voteSubmitted}
                style={{
                  flex: 1,
                  borderRadius: '24px',
                  border: 'none',
                  background: (myVote === 'ao' || pendingVote === 'ao') ? 'var(--ao)' : 'rgba(26,77,181,0.1)',
                  borderWidth: (myVote === 'ao' || pendingVote === 'ao') ? '0' : '2px',
                  borderStyle: 'solid',
                  borderColor: 'var(--ao)',
                  color: (myVote === 'ao' || pendingVote === 'ao') ? '#fff' : 'var(--ao)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '24px',
                  cursor: voteSubmitted ? 'not-allowed' : 'pointer',
                  opacity: voteSubmitted ? 0.5 : 1,
                  transition: 'all 0.2s',
                  boxShadow: (myVote === 'ao' || pendingVote === 'ao') ? '0 12px 48px rgba(26,77,181,0.4)' : 'none',
                }}
              >
                <FlagIcon color={(myVote === 'ao' || pendingVote === 'ao') ? '#fff' : 'var(--ao)'} />
                <div style={{ fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AO</div>
                <div style={{ fontSize: '14px', fontWeight: 600, opacity: 0.8 }}>{aoName}</div>
              </button>
            </div>
          </>
        )}
      </div>

      {voteSubmitted && (
        <div style={{ background: '#10b981', color: '#fff', padding: '16px', textAlign: 'center', fontWeight: 800, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Vote Recorded: {pendingVote?.toUpperCase()}
        </div>
      )}

      {liveData?.boutFinished && !voteSubmitted && voteCountdown === 0 && (
        <div style={{ background: '#f59e0b', color: '#fff', padding: '16px', textAlign: 'center', fontWeight: 800, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Match Finished: Time Expired
        </div>
      )}
    </main>
  );
}

export default function JudgePanel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <JudgePanelInner id={id} />
    </Suspense>
  );
}
