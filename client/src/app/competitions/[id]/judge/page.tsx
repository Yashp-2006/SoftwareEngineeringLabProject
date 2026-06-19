'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { Award, Loader2, ShieldAlert, LogOut, ArrowLeft, Lock } from 'lucide-react';
import PageSkeleton from '@/components/layout/PageSkeleton';
import { toast } from 'react-hot-toast';

// ─── Flag SVG Component ─────────────────────────────────────────────────────────
const FlagIcon = ({ color, size = 120 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12z" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="4" y1="22" x2="4" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function JudgePanel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { user, loading: authLoading } = useAuth();

  const [matId, setMatId] = useState<string | null>(null);
  const [judgeIndex, setJudgeIndex] = useState<number | null>(null);
  
  const [liveData, setLiveData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 5-second countdown state
  const [voteCountdown, setVoteCountdown] = useState<number | null>(null);
  const [pendingVote, setPendingVote] = useState<'aka' | 'ao' | null>(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);

  // Dynamic judge count from the live match data
  const configuredJudgeCount = liveData?.numberOfJudges || null;

  useEffect(() => {
    if (!matId || judgeIndex === null) return;
    
    let unsub: () => void;
    setLoading(true);

    const setup = async () => {
      try {
        const { rtdb } = await import('@lib/firebase');
        const { ref, onValue } = await import('firebase/database');
        
        const r = ref(rtdb, `live_scores/${id}/mats/${matId}`);
        unsub = onValue(r, (snap) => {
          if (snap.exists()) {
            setLiveData(snap.val());
          } else {
            setLiveData(null);
          }
          setLoading(false);
        });
      } catch (err) {
        console.error('Failed to listen to live scores', err);
        setLoading(false);
      }
    };

    setup();
    return () => { if (unsub) unsub(); };
  }, [id, matId, judgeIndex]);

  // 5-second countdown timer when bout finishes
  useEffect(() => {
    if (liveData?.boutFinished && voteCountdown === null && !voteSubmitted) {
      setVoteCountdown(5);
    }
  }, [liveData?.boutFinished]);

  useEffect(() => {
    if (voteCountdown === null || voteCountdown <= 0) return;
    const timer = setTimeout(() => {
      setVoteCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [voteCountdown]);

  // When countdown hits 0, submit the pending vote
  useEffect(() => {
    if (voteCountdown === 0 && pendingVote && !voteSubmitted) {
      submitVote(pendingVote);
      setVoteSubmitted(true);
    }
  }, [voteCountdown]);

  const submitVote = async (vote: 'aka' | 'ao') => {
    try {
      const { rtdb } = await import('@lib/firebase');
      const { ref, update } = await import('firebase/database');
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
      toast.success('Vote submitted!');
    } catch (err) {
      console.error('Vote submission failed', err);
      toast.error('Failed to submit vote.');
    }
  };

  const handleFlagVote = async (vote: 'aka' | 'ao') => {
    // If bout is finished, use the countdown mechanism
    if (liveData?.boutFinished) {
      if (voteSubmitted) {
        toast.error("Vote already submitted.");
        return;
      }
      setPendingVote(vote);
      if (navigator.vibrate) navigator.vibrate(50);
      return;
    }

    // Normal voting during match
    try {
      const { rtdb } = await import('@lib/firebase');
      const { ref, update } = await import('firebase/database');
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
      
      if (navigator.vibrate) {
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
          The Judge Panel requires authentication. Please sign in with your assigned judge account to access the voting interface.
        </p>
        <Link href="/login" className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '15px' }}>
          Sign In
        </Link>
      </main>
    );
  }

  // ─── Mat & Judge Selection ──────────────────────────────────────────
  // Use available mats
  const mats = ['MAT 01', 'MAT 02', 'MAT 03', 'MAT 04', 'MAT 05', 'MAT 06', 'MAT 07', 'MAT 08'];
  
  // Dynamic judge count — use configured count from live data, otherwise show selection UI
  const judgeCount = configuredJudgeCount || 7;
  const judges = Array.from({ length: judgeCount }, (_, i) => i);

  if (!matId || judgeIndex === null) {
    return (
      <main className="container" style={{ maxWidth: '600px', paddingTop: 'var(--space-8)' }}>
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
            <div>
              <h1 style={{ fontSize: '24px', marginBottom: '4px' }}>Judge Assignment</h1>
              <p className="text-small">Select your assigned Mat and Position.</p>
            </div>
            <Link href={`/competitions/${id}`} className="btn btn-ghost">
              <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Back
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Select Mat</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {mats.map(m => (
                  <button 
                    key={m}
                    className={`btn ${matId === m ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setMatId(m)}
                    style={{ padding: '12px 8px', fontSize: '13px' }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Select Position</label>
              <p style={{ fontSize: '12px', color: 'var(--neutral-500)', marginBottom: '8px' }}>
                {configuredJudgeCount 
                  ? `This match has ${configuredJudgeCount} judges configured.`
                  : 'Showing all positions. Select your mat first to see configured count.'
                }
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(judges.length, 7)}, 1fr)`, gap: '8px' }}>
                {judges.map(j => (
                  <button 
                    key={j}
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
                <strong>Note:</strong> Ensure your selection matches the assignment given to you by the tournament director. Your votes will be recorded live.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Find out what we voted for
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
      <header style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Award size={24} color="#3b82f6" />
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.05em' }}>LIVE JUDGE PANEL</div>
            <div style={{ fontSize: '12px', color: 'var(--neutral-400)' }}>{matId} · Judge {judgeIndex + 1}</div>
          </div>
        </div>
        <button 
          onClick={() => { setMatId(null); setJudgeIndex(null); setVoteCountdown(null); setPendingVote(null); setVoteSubmitted(false); }}
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--shiro)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Change Mat
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflow: 'hidden' }}>
        {loading ? (
          <PageSkeleton darkMode={true} />
        ) : (
          /* ─── Always Show voting flags ─── */
          <>
            {/* Competitor names banner */}
            {(liveData?.matchId || liveData?.akaName || liveData?.aoName) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
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
              `}</style>
              <button
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
                  boxShadow: (myVote === 'aka' || pendingVote === 'aka') ? '0 12px 48px rgba(217,38,44,0.4)' : 'none'
                }}
              >
                <FlagIcon color={(myVote === 'aka' || pendingVote === 'aka') ? '#fff' : 'var(--aka)'} />
                <div style={{ fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AKA</div>
                <div style={{ fontSize: '14px', fontWeight: 600, opacity: 0.8 }}>{akaName}</div>
              </button>
              <button
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
                  boxShadow: (myVote === 'ao' || pendingVote === 'ao') ? '0 12px 48px rgba(26,77,181,0.4)' : 'none'
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
          Vote Recorded — {pendingVote?.toUpperCase()}
        </div>
      )}

      {liveData?.boutFinished && !voteSubmitted && voteCountdown === 0 && (
        <div style={{ background: '#f59e0b', color: '#fff', padding: '16px', textAlign: 'center', fontWeight: 800, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Match Finished — Time Expired
        </div>
      )}
    </main>
  );
}
