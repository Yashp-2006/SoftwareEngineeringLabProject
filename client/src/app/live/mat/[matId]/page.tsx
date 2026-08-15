'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import KataLiveScoreboard, { deriveJudgeVotes } from '@/modules/kata/components/KataLiveScoreboard';

export default function LiveMatPage({ params }: { params: Promise<{ matId: string }> }) {
  const { matId } = React.use(params);
  const [time, setTime] = useState(102);

  const [matchData, setMatchData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeMat: () => void;

    const setupListeners = async () => {
      try {
        const { ref, onValue } = await import('firebase/database');
        const { rtdb } = await import('@lib/firebase');
        
        // Get competitionId from URL search params e.g. /live/mat/1?competition=abc123
        const params = new URLSearchParams(window.location.search);
        const competitionId = params.get('competition') || 'default';
        
        // Read from the same path the operator page writes to
        const matRef = ref(rtdb, `live_scores/${competitionId}/mats/${matId}`);
        
        unsubscribeMat = onValue(matRef, (snapshot) => {
          const val = snapshot.val();
          if (val) {
            // Map from operator's enriched payload to local matchData shape
            setMatchData({
              currentCategory: val.currentCategory || 'UNKNOWN CATEGORY',
              aka: {
                name: val.akaName || 'AKA',
                country: val.akaCountry || '',
                academy: val.akaAcademy || '',
                score: val.scores?.aka ?? 0,
                penalties: {
                  C1: val.akaPenalties?.c1 ?? false,
                  C2: val.akaPenalties?.c2 ?? false,
                  C3: val.akaPenalties?.c3 ?? false,
                  HC: val.akaPenalties?.hc ?? false,
                  H:  val.akaPenalties?.h  ?? false,
                },
              },
              ao: {
                name: val.aoName || 'AO',
                country: val.aoCountry || '',
                academy: val.aoAcademy || '',
                score: val.scores?.ao ?? 0,
                penalties: {
                  C1: val.aoPenalties?.c1 ?? false,
                  C2: val.aoPenalties?.c2 ?? false,
                  C3: val.aoPenalties?.c3 ?? false,
                  HC: val.aoPenalties?.hc ?? false,
                  H:  val.aoPenalties?.h  ?? false,
                },
              },
              status: val.status || 'standby',
              timerSeconds: val.timerSeconds ?? 0,
              timerRunning: val.timerRunning ?? false,
              isKata: val.isKata || (val.currentCategory && val.currentCategory.toLowerCase().includes('kata')) || false,
              kataPhase: val.phase,
              kataScores: val.kataScores,
              kataVotes: val.kataVotes,
              kataWinner: val.kataWinner,
              selectedKata: val.selectedKata,
              teamTimerSeconds: val.teamTimerSeconds,
              numberOfJudges: val.numberOfJudges || 3,
            });
            setTime(val.teamTimerSeconds ?? val.timerSeconds ?? 0);
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
    };
  }, [matId]);


  // Local timer fallback just to look alive if timerRunning is true
  useEffect(() => {
    if (!matchData?.timerRunning) return;
    const timer = setInterval(() => {
      setTime(prev => {
        if (matchData.isKata && matchData.teamTimerSeconds === undefined) {
          return prev + 1; // Ascending for individual kata
        }
        return prev > 0 ? prev - 1 : 0; // Descending otherwise
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [matchData?.timerRunning, matchData?.isKata, matchData?.teamTimerSeconds]);

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
        
        .kata-name {
          font-family: var(--font-display);
          font-size: 28px;
          color: var(--shiro);
          text-transform: uppercase;
          margin-top: var(--space-4);
          text-align: center;
          letter-spacing: 0.1em;
          background: rgba(0,0,0,0.2);
          padding: 8px 16px;
          border-radius: 8px;
        }
        .judge-scores-row {
          display: flex;
          gap: var(--space-4);
          margin-top: var(--space-6);
        }
        .judge-score-box {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: 24px;
          font-weight: 700;
        }

        /* Animations */
        .mat-reveal-aka { animation: slideInLeft 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
        .mat-reveal-ao { animation: slideInRight 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
        .mat-reveal-center { animation: popIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.2s forwards; opacity: 0; transform: scale(0.8); }

        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-100px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes popIn { to { opacity: 1; transform: scale(1); } }

        /* Responsive Scaling for TV & Mobile */
        @media (max-width: 1024px) {
          .score-board {
            grid-template-columns: 1fr 140px 1fr;
            gap: var(--space-4);
          }
          .score-value { font-size: 140px; }
          .competitor-name { font-size: 40px; }
          .timer-value { font-size: 60px; }
        }
        @media (max-width: 768px) {
          .score-board {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto auto;
            gap: var(--space-4);
          }
          .score-value { font-size: 80px; }
          .competitor-name { font-size: 28px; }
          .timer-value { font-size: 48px; }
          .timer-center { order: -1; margin-bottom: 20px; }
          .competitor-side { padding: var(--space-4); }
        }
      `}} />

      {/* Scoreboard-specific minimal nav strip */}
      <div style={{ height: '48px', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', padding: '0 var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="nav-logo" style={{ color: 'var(--shiro)', fontSize: '18px', letterSpacing: '0.1em', marginRight: 'auto' }}>TAIKAIX LIVE</div>
        <Link href="/competitions" style={{ color: 'var(--neutral-400)', fontSize: '13px', textDecoration: 'none', transition: 'color 0.2s' }}>← Back to Operations</Link>
      </div>

      <div className="mat-container">
        <div className="mat-header">
          <div className="nav-logo" style={{ color: 'var(--shiro)' }}>TAIKAIX <span style={{ color: 'var(--neutral-500)' }}>| MAT {matId.padStart(2, '0')}</span></div>
          <div className="category-label" style={{ textTransform: 'uppercase' }}>{matchData?.currentCategory || 'UNKNOWN CATEGORY'}</div>
          <div className="data-mono" style={{ color: 'var(--neutral-500)' }}>KYOTO 2026 FINALS</div>
        </div>

        <div className="score-board">
          {loading ? (
             <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px' }}>Connecting to Mat...</div>
          ) : !matchData ? (
             <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px', fontSize: '24px', color: 'var(--neutral-400)' }}>
               No Active Match
             </div>
          ) : matchData?.isKata ? (() => {
            // Kata mode: use the shared KataLiveScoreboard component
            const nJudges = matchData.numberOfJudges || 3;
            const { judgeVotes, akaFlags, aoFlags } = deriveJudgeVotes(matchData.kataScores, nJudges);
            return (
              <KataLiveScoreboard
                akaName={matchData.aka?.name || 'AKA'}
                aoName={matchData.ao?.name || 'AO'}
                akaAcademy={matchData.aka?.academy}
                aoAcademy={matchData.ao?.academy}
                akaCountry={matchData.aka?.country}
                aoCountry={matchData.ao?.country}
                akaKataName={matchData.selectedKata?.aka?.name}
                aoKataName={matchData.selectedKata?.ao?.name}
                numberOfJudges={nJudges}
                judgeVotes={judgeVotes}
                akaFlags={matchData.kataVotes?.aka ?? akaFlags}
                aoFlags={matchData.kataVotes?.ao ?? aoFlags}
                revealVotes={matchData.revealVotes === true}
                revealCountdown={matchData.revealCountdown || 0}
                timeRemaining={formatTime(time)}
                matchStatus={matchData.status === 'live' ? 'LIVE' : matchData.status?.toUpperCase() || 'STANDBY'}
                title={`TAIKAIX LIVE — MAT ${matId.padStart(2, '0')}`}
                subtitle={matchData.currentCategory || 'KATA'}
                kataWinner={matchData.kataWinner}
                winnerName={matchData.kataWinner === 'aka' ? matchData.aka?.name : matchData.kataWinner === 'ao' ? matchData.ao?.name : undefined}
              />
            );
          })() : (
            <>
              {/* AKA Side */}
              <div className="competitor-side aka mat-reveal-aka">
                {matchData.isKata ? (
                  <div className="score-value">{matchData.kataVotes?.aka || 0}</div>
                ) : (
                  <div className="score-value">{matchData.aka?.score || 0}</div>
                )}
                <div className="competitor-name">{matchData.aka?.name || 'AKA'}</div>
                <div className="text-micro" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {[matchData.aka?.academy, matchData.aka?.country].filter(Boolean).join(' • ').toUpperCase() || 'COUNTRY'}
                </div>
                {matchData.isKata ? (
                  <>
                    <div className="kata-name" style={{ fontStyle: matchData.selectedKata?.aka?.name ? 'normal' : 'italic', color: matchData.selectedKata?.aka?.name ? 'var(--shiro)' : 'rgba(255,255,255,0.4)' }}>
                      {matchData.selectedKata?.aka?.name ? `KATA NAME: ${matchData.selectedKata.aka.name}` : 'KATA NOT SELECTED'}
                    </div>
                    {matchData.kataScores?.aka && matchData.kataScores?.ao && (
                      <div className="judge-scores-row">
                        {Object.values(matchData.kataScores.aka).map((s: any, i) => {
                          const a = s;
                          const b = matchData.kataScores.ao[i];
                          let vote = '-';
                          let bg = 'rgba(255,255,255,0.1)';
                          if (a !== null && b !== null) {
                            if (a > b) { vote = 'AKA'; bg = 'var(--aka)'; }
                            else if (b > a) { vote = 'AO'; bg = 'var(--ao)'; }
                            else { vote = 'TIE'; bg = 'var(--neutral-500)'; }
                          }
                          return (
                            <div key={i} className="judge-score-box" style={{ background: bg, fontSize: '14px', border: 'none' }}>
                              {vote}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="penalty-row">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`penalty-dot ${i < calculatePenalties(matchData.aka?.penalties) ? 'active' : ''}`}></div>
                    ))}
                  </div>
                )}
              </div>

              {/* Center Timer */}
              <div className="timer-center mat-reveal-center">
                <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>
                  {matchData.isKata && matchData.teamTimerSeconds === undefined ? 'PERFORMANCE TIME' : 'TIME REMAINING'}
                </div>
                <div className="timer-value" style={{ color: time < 10 && !matchData.isKata ? 'var(--aka)' : 'var(--status-live)' }}>
                  {formatTime(time)}
                </div>
                <div className="status-chip status-live">{matchData.status === 'live' ? 'Match Live' : 'Paused'}</div>
                
                {matchData.isKata && (
                  <div style={{ marginTop: 'var(--space-4)', fontSize: '20px', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.1em' }}>
                    {matchData.kataPhase === 'bunkai' ? 'BUNKAI' : 'KATA'}
                  </div>
                )}

                <div style={{ marginTop: 'var(--space-8)', textAlign: 'center' }}>
                  <div className="text-micro" style={{ color: 'var(--neutral-500)', marginBottom: '8px' }}>NEXT UP</div>
                  <div className="text-small" style={{ color: 'var(--shiro)' }}>PENDING</div>
                </div>
              </div>

              {/* AO Side */}
              <div className="competitor-side ao mat-reveal-ao">
                {matchData.isKata ? (
                  <div className="score-value">{matchData.kataVotes?.ao || 0}</div>
                ) : (
                  <div className="score-value">{matchData.ao?.score || 0}</div>
                )}
                <div className="competitor-name">{matchData.ao?.name || 'AO'}</div>
                <div className="text-micro" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {[matchData.ao?.academy, matchData.ao?.country].filter(Boolean).join(' • ').toUpperCase() || 'COUNTRY'}
                </div>
                {matchData.isKata ? (
                  <>
                    <div className="kata-name" style={{ fontStyle: matchData.selectedKata?.ao?.name ? 'normal' : 'italic', color: matchData.selectedKata?.ao?.name ? 'var(--shiro)' : 'rgba(255,255,255,0.4)' }}>
                      {matchData.selectedKata?.ao?.name ? `KATA NAME: ${matchData.selectedKata.ao.name}` : 'KATA NOT SELECTED'}
                    </div>
                    {matchData.kataScores?.aka && matchData.kataScores?.ao && (
                      <div className="judge-scores-row">
                        {Object.values(matchData.kataScores.ao).map((s: any, i) => {
                          const b = s;
                          const a = matchData.kataScores.aka[i];
                          let vote = '-';
                          let bg = 'rgba(255,255,255,0.1)';
                          if (a !== null && b !== null) {
                            if (a > b) { vote = 'AKA'; bg = 'var(--aka)'; }
                            else if (b > a) { vote = 'AO'; bg = 'var(--ao)'; }
                            else { vote = 'TIE'; bg = 'var(--neutral-500)'; }
                          }
                          return (
                            <div key={i} className="judge-score-box" style={{ background: bg, fontSize: '14px', border: 'none' }}>
                              {vote}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="penalty-row">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`penalty-dot ${i < calculatePenalties(matchData.ao?.penalties) ? 'active' : ''}`}></div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
