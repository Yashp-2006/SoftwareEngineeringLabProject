'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { ShieldAlert, LogOut, ArrowLeft, Loader2, Award } from 'lucide-react';
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
  const { user } = useAuth();

  const [matId, setMatId] = useState<string | null>(null);
  const [judgeIndex, setJudgeIndex] = useState<number | null>(null);
  
  const [liveData, setLiveData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Available mats could be fetched from competition document, but we'll hardcode 1-8 for simplicity or let them type it
  const mats = ['MAT 01', 'MAT 02', 'MAT 03', 'MAT 04', 'MAT 05', 'MAT 06', 'MAT 07', 'MAT 08'];
  const judges = [0, 1, 2, 3, 4, 5, 6];

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

  const handleFlagVote = async (vote: 'aka' | 'ao' | 'tie') => {
    if (liveData?.boutFinished) {
      toast.error("Bout is already finished.");
      return;
    }

    try {
      const { rtdb } = await import('@lib/firebase');
      const { ref, update } = await import('firebase/database');
      const r = ref(rtdb, `live_scores/${id}/mats/${matId}/kataScores`);
      
      const patch: any = {};
      if (vote === 'aka') {
        patch[`aka/${judgeIndex}`] = 1;
        patch[`ao/${judgeIndex}`] = 0;
      } else if (vote === 'ao') {
        patch[`aka/${judgeIndex}`] = 0;
        patch[`ao/${judgeIndex}`] = 1;
      } else if (vote === 'tie') {
        patch[`aka/${judgeIndex}`] = 0;
        patch[`ao/${judgeIndex}`] = 0;
      }

      await update(r, patch);
      
      // Provide haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (err) {
      console.error('Vote failed', err);
      toast.error('Failed to submit vote. Check connection.');
    }
  };

  if (!user) {
    return (
      <main className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)' }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: 'var(--space-6)' }}>
          <ShieldAlert style={{ width: '48px', height: '48px', color: 'var(--neutral-400)', margin: '0 auto var(--space-4)' }} />
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Authentication Required</h2>
          <p className="text-small" style={{ marginBottom: 'var(--space-5)' }}>You must be logged in to access the Judge Panel.</p>
          <Link href="/auth" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Sign In</Link>
        </div>
      </main>
    );
  }

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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
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

  const isKata = liveData?.isKata;

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
          onClick={() => { setMatId(null); setJudgeIndex(null); }}
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--shiro)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Change Mat
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'var(--neutral-400)' }}>
            <Loader2 className="spin" size={32} />
            <p>Connecting to {matId}...</p>
          </div>
        ) : !liveData ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--neutral-400)' }}>
            <p style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No active match on {matId}</p>
            <p style={{ fontSize: '14px' }}>Waiting for the operator to start a match...</p>
          </div>
        ) : !isKata ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--neutral-400)' }}>
            <p style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Current match is Kumite</p>
            <p style={{ fontSize: '14px' }}>Kata Judge Panel only supports Kata matches.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', gap: '24px' }}>
            <button
              onClick={() => handleFlagVote('aka')}
              disabled={liveData.boutFinished}
              style={{
                flex: 1,
                borderRadius: '24px',
                border: 'none',
                background: myVote === 'aka' ? 'var(--aka)' : 'rgba(217,38,44,0.1)',
                borderWidth: myVote === 'aka' ? '0' : '2px',
                borderStyle: 'solid',
                borderColor: 'var(--aka)',
                color: myVote === 'aka' ? '#fff' : 'var(--aka)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '24px',
                cursor: liveData.boutFinished ? 'not-allowed' : 'pointer',
                opacity: liveData.boutFinished ? 0.5 : 1,
                transition: 'all 0.2s',
                boxShadow: myVote === 'aka' ? '0 12px 48px rgba(217,38,44,0.4)' : 'none'
              }}
            >
              <FlagIcon color={myVote === 'aka' ? '#fff' : 'var(--aka)'} />
              <div style={{ fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AKA</div>
            </button>
            <button
              onClick={() => handleFlagVote('ao')}
              disabled={liveData.boutFinished}
              style={{
                flex: 1,
                borderRadius: '24px',
                border: 'none',
                background: myVote === 'ao' ? 'var(--ao)' : 'rgba(26,77,181,0.1)',
                borderWidth: myVote === 'ao' ? '0' : '2px',
                borderStyle: 'solid',
                borderColor: 'var(--ao)',
                color: myVote === 'ao' ? '#fff' : 'var(--ao)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '24px',
                cursor: liveData.boutFinished ? 'not-allowed' : 'pointer',
                opacity: liveData.boutFinished ? 0.5 : 1,
                transition: 'all 0.2s',
                boxShadow: myVote === 'ao' ? '0 12px 48px rgba(26,77,181,0.4)' : 'none'
              }}
            >
              <FlagIcon color={myVote === 'ao' ? '#fff' : 'var(--ao)'} />
              <div style={{ fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AO</div>
            </button>
          </div>
        )}
      </div>

      {liveData?.boutFinished && (
        <div style={{ background: '#f59e0b', color: '#fff', padding: '16px', textAlign: 'center', fontWeight: 800, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Match Finished
        </div>
      )}
    </main>
  );
}
