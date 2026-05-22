'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

export default function LiveMatPage({ params }: { params: Promise<{ matId: string }> }) {
  const { matId } = React.use(params);
  const [time, setTime] = useState(102);

  const [matchData, setMatchData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeMat: () => void;
    let unsubscribeMatch: () => void;

    const setupListeners = async () => {
      try {
        const { ref, onValue } = await import('firebase/database');
        const { rtdb } = await import('@lib/firebase');
        
        // Listen to mat status
        const matRef = ref(rtdb, `matStatus/${matId}`);
        unsubscribeMat = onValue(matRef, (snapshot) => {
          const matVal = snapshot.val();
          if (matVal && matVal.currentMatchId) {
            // Unsubscribe previous match if any
            if (unsubscribeMatch) unsubscribeMatch();
            
            // Listen to current live match
            const matchRef = ref(rtdb, `liveMatches/${matVal.currentMatchId}`);
            unsubscribeMatch = onValue(matchRef, (matchSnap) => {
              const val = matchSnap.val();
              if (val) {
                setMatchData(val);
                setTime(val.timerSeconds || 0);
              }
            });
          } else {
            setMatchData(null);
          }
          setLoading(false);
        });
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      if (unsubscribeMat) unsubscribeMat();
      if (unsubscribeMatch) unsubscribeMatch();
    };
  }, [matId]);

  // Local timer fallback just to look alive if timerRunning is true
  useEffect(() => {
    if (!matchData?.timerRunning) return;
    const timer = setInterval(() => {
      setTime(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [matchData?.timerRunning]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const calculatePenalties = (p: any) => {
    if (!p) return 0;
    return (p.C1?1:0) + (p.C2?1:0) + (p.C3?1:0) + (p.HC?1:0) + (p.H?1:0);
  };

  return (
    <div style={{ backgroundColor: 'var(--kuro)', color: 'var(--shiro)', minHeight: '100vh', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .mat-container {
          height: calc(100vh - var(--nav-height) - 52px);
          display: flex;
          flex-direction: column;
          padding: var(--space-6);
        }
        .mat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-8);
        }
        .score-board {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 200px 1fr;
          gap: var(--space-8);
          align-items: center;
        }
        .competitor-side {
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border-radius: 20px;
          padding: var(--space-8);
        }
        .competitor-side.aka { background-color: var(--aka); }
        .competitor-side.ao { background-color: var(--ao); }
        .score-value {
          font-family: var(--font-display);
          font-size: 240px;
          line-height: 0.8;
          margin-bottom: var(--space-4);
        }
        .competitor-name {
          font-family: var(--font-display);
          font-size: 64px;
          text-transform: uppercase;
          text-align: center;
        }
        .timer-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
        }
        .timer-value {
          font-family: var(--font-mono);
          font-size: 84px;
          color: var(--status-live);
        }
        .category-label {
          font-family: var(--font-display);
          font-size: 24px;
          color: var(--neutral-300);
          letter-spacing: 0.1em;
        }
        .penalty-row {
          display: flex;
          gap: var(--space-2);
          margin-top: var(--space-4);
        }
        .penalty-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.4);
        }
        .penalty-dot.active { background: var(--shiro); }

        /* Animations */
        .mat-reveal-aka { animation: slideInLeft 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
        .mat-reveal-ao { animation: slideInRight 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
        .mat-reveal-center { animation: popIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.2s forwards; opacity: 0; transform: scale(0.8); }

        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-100px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes popIn { to { opacity: 1; transform: scale(1); } }
      `}} />

      <nav style={{ backgroundColor: 'var(--shiro)' }}>
        <div className="nav-logo" style={{ color: 'var(--kuro)' }}>TAIKAIX</div>
        <div className="nav-links">
          <Link href="/" className="nav-link">Dashboard</Link>
          <Link href="/competitions" className="nav-link active">Competitions</Link>
          <Link href="/users" className="nav-link">Users</Link>
        </div>
        <div className="nav-profile">
          <Link href="/profile" className="avatar" style={{ border: '2px solid transparent', transition: 'border-color 0.2s' }}></Link>
          <ChevronDown size={16} style={{ color: 'var(--neutral-500)' }} />
        </div>
      </nav>

      <div className="sub-nav" style={{ backgroundColor: 'var(--neutral-50)' }}>
        <Link href="#" className="sub-nav-link">Overview</Link>
        <Link href="#" className="sub-nav-link">Categories</Link>
        <Link href="#" className="sub-nav-link">Tiesheet</Link>
        <Link href="#" className="sub-nav-link active">Mats</Link>
        <Link href="#" className="sub-nav-link">Staff</Link>
        <Link href="#" className="sub-nav-link">Athletes</Link>
        <Link href="#" className="sub-nav-link">Medals</Link>
        <Link href="#" className="sub-nav-link">Schedule</Link>
        <div style={{ flex: 1 }}></div>
      </div>

      <div className="mat-container">
        <div className="mat-header">
          <div className="nav-logo" style={{ color: 'var(--shiro)' }}>TAIKAIX <span style={{ color: 'var(--neutral-500)' }}>| MAT {matId.padStart(2, '0')}</span></div>
          <div className="category-label">SENIOR MALE KUMITE -75KG</div>
          <div className="data-mono" style={{ color: 'var(--neutral-500)' }}>KYOTO 2026 FINALS</div>
        </div>

        <div className="score-board">
          {loading ? (
             <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px' }}>Connecting to Mat...</div>
          ) : !matchData ? (
             <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px', fontSize: '24px', color: 'var(--neutral-400)' }}>
               No Active Match
             </div>
          ) : (
            <>
              {/* AKA Side */}
              <div className="competitor-side aka mat-reveal-aka">
                <div className="score-value">{matchData.aka?.score || 0}</div>
                <div className="competitor-name">{matchData.aka?.name || 'AKA'}</div>
                <div className="text-micro" style={{ color: 'rgba(255,255,255,0.8)' }}>{matchData.aka?.country || 'COUNTRY'}</div>
                <div className="penalty-row">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`penalty-dot ${i < calculatePenalties(matchData.aka?.penalties) ? 'active' : ''}`}></div>
                  ))}
                </div>
              </div>

              {/* Center Timer */}
              <div className="timer-center mat-reveal-center">
                <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>TIME REMAINING</div>
                <div className="timer-value" style={{ color: time < 10 ? 'var(--aka)' : 'var(--status-live)' }}>
                  {formatTime(time)}
                </div>
                <div className="status-chip status-live">{matchData.status === 'ongoing' ? 'Match Live' : 'Paused'}</div>
                <div style={{ marginTop: 'var(--space-8)', textAlign: 'center' }}>
                  <div className="text-micro" style={{ color: 'var(--neutral-500)', marginBottom: '8px' }}>NEXT UP</div>
                  <div className="text-small" style={{ color: 'var(--shiro)' }}>PENDING</div>
                </div>
              </div>

              {/* AO Side */}
              <div className="competitor-side ao mat-reveal-ao">
                <div className="score-value">{matchData.ao?.score || 0}</div>
                <div className="competitor-name">{matchData.ao?.name || 'AO'}</div>
                <div className="text-micro" style={{ color: 'rgba(255,255,255,0.8)' }}>{matchData.ao?.country || 'COUNTRY'}</div>
                <div className="penalty-row">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`penalty-dot ${i < calculatePenalties(matchData.ao?.penalties) ? 'active' : ''}`}></div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
