'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Scale, Play, Pause } from 'lucide-react';
import KataSelectionRow from './KataSelectionRow';
import JudgeScoreGrid from './JudgeScoreGrid';
import FoulPanel from './FoulPanel';
import DQPanel from './DQPanel';
import TieResolutionModal from './TieResolutionModal';
import { KATA_LIST, KataEntry } from '@/lib/kata-list';

interface Props {
  competitionId: string;
  categoryId: string;
  matchId: string;
  matId: string;
  akaName: string;
  aoName: string;
  akaId?: string;
  aoId?: string;
  numberOfJudges: number;
  allowedKataNumbers: number[];
  kataFormat: 'elimination' | 'round-robin' | 'two-pool';
  isTeam?: boolean;
  onMatchFinished: (winner: 'aka' | 'ao', voteCount: { aka: number; ao: number }) => void;
  onClose?: () => void;
}

type JudgeScores = Record<number, number | null>;

// Helpers
function initJudgeScores(n: number): JudgeScores {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [i, null]));
}

function computeVotes(
  akaScores: JudgeScores,
  aoScores: JudgeScores,
  n: number
): { aka: number; ao: number; tied: number[] } {
  let aka = 0, ao = 0;
  const tied: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = akaScores[i] ?? null;
    const b = aoScores[i] ?? null;
    if (a === null || b === null) continue;
    if (a > b) aka++;
    else if (b > a) ao++;
    else tied.push(i);
  }
  return { aka, ao, tied };
}

export default function KataOperatorPanel({
  competitionId,
  categoryId,
  matchId,
  matId,
  akaName,
  aoName,
  akaId,
  aoId,
  numberOfJudges,
  allowedKataNumbers,
  kataFormat,
  isTeam,
  onMatchFinished,
}: Props) {
  const [selectedKata, setSelectedKata] = useState<{ aka: KataEntry | null; ao: KataEntry | null }>({ aka: null, ao: null });
  const [akaUsageMap, setAkaUsageMap] = useState<Record<number, number>>({});
  const [aoUsageMap, setAoUsageMap] = useState<Record<number, number>>({});

  const [phase, setPhase] = useState<'kata' | 'bunkai'>('kata');
  const [boutStarted, setBoutStarted] = useState(false);
  const [boutFinished, setBoutFinished] = useState(false);

  const [akaScores, setAkaScores] = useState<JudgeScores>(initJudgeScores(numberOfJudges));
  const [aoScores, setAoScores] = useState<JudgeScores>(initJudgeScores(numberOfJudges));

  const [isDQ, setIsDQ] = useState<{ aka: boolean; ao: boolean }>({ aka: false, ao: false });
  const [fouls, setFouls] = useState<{ aka: string[]; ao: string[] }>({ aka: [], ao: [] });
  const [errorCells, setErrorCells] = useState<{ aka: Set<number>; ao: Set<number> }>({ aka: new Set(), ao: new Set() });

  const [voteResult, setVoteResult] = useState<{ aka: number; ao: number; tied: number[] } | null>(null);
  const [kataWinner, setKataWinner] = useState<'aka' | 'ao' | 'tie_pending' | null>(null);

  const [tieModalOpen, setTieModalOpen] = useState(false);

  // Team timer (5:00)
  const [teamTimer, setTeamTimer] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerWarning, setTimerWarning] = useState(false);

  // Sync state to RTDB
  const syncRTDB = useCallback(
    async (patch: Record<string, any>) => {
      try {
        const { rtdb } = await import('@lib/firebase');
        const { ref, update } = await import('firebase/database');
        const r = ref(rtdb, `live_scores/${competitionId}/mats/${matId}`);
        await update(r, patch);
      } catch (err) {
        console.error('Kata RTDB sync failed', err);
      }
    },
    [competitionId, matId]
  );

  // Load kata usage history for repetition enforcement
  useEffect(() => {
    const load = async () => {
      if (!akaId && !aoId) return;
      try {
        const { db } = await import('@lib/firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'competitions', competitionId, 'categories'));
        const akaMap: Record<number, number> = {};
        const aoMap: Record<number, number> = {};

        snap.docs.forEach((d) => {
          const cat = d.data();
          (cat.matches || []).forEach((m: any) => {
            if (m.status !== 'completed' || m.id === matchId) return;
            if (m.selectedKata?.aka?.number && (m.aka?.playerId === akaId || m.aka?.name === akaName)) {
              const n = m.selectedKata.aka.number;
              akaMap[n] = (akaMap[n] || 0) + 1;
            }
            if (m.selectedKata?.ao?.number && (m.ao?.playerId === akaId || m.ao?.name === akaName)) {
              const n = m.selectedKata.ao.number;
              akaMap[n] = (akaMap[n] || 0) + 1;
            }
            if (m.selectedKata?.aka?.number && (m.aka?.playerId === aoId || m.aka?.name === aoName)) {
              const n = m.selectedKata.aka.number;
              aoMap[n] = (aoMap[n] || 0) + 1;
            }
            if (m.selectedKata?.ao?.number && (m.ao?.playerId === aoId || m.ao?.name === aoName)) {
              const n = m.selectedKata.ao.number;
              aoMap[n] = (aoMap[n] || 0) + 1;
            }
          });
        });

        setAkaUsageMap(akaMap);
        setAoUsageMap(aoMap);
      } catch (err) {
        console.error('Failed to load kata history', err);
      }
    };
    load();
  }, [competitionId, matchId, akaId, aoId, akaName, aoName]);

  // Team timer
  useEffect(() => {
    if (!isTeam || !timerRunning) return;
    if (teamTimer <= 0) {
      setTimerRunning(false);
      toast.error('Time limit reached! Confirm DQ or proceed.');
      return;
    }
    const t = setInterval(() => {
      setTeamTimer((s) => {
        const next = s - 1;
        if (next === 30) setTimerWarning(true);
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isTeam, timerRunning, teamTimer]);

  const handleScoreChange = (side: 'aka' | 'ao', judgeIdx: number, value: number | null) => {
    if (boutFinished) return;
    const setter = side === 'aka' ? setAkaScores : setAoScores;
    setter((prev) => ({ ...prev, [judgeIdx]: value }));

    // Clear error highlight for this cell
    setErrorCells((prev) => {
      const next = { aka: new Set(prev.aka), ao: new Set(prev.ao) };
      next[side].delete(judgeIdx);
      return next;
    });

    // Real-time RTDB write
    const key = side === 'aka' ? 'kataScores.aka' : 'kataScores.ao';
    syncRTDB({ [`${key}.${judgeIdx}`]: value });
  };

  const handleDQJudge = (side: 'aka' | 'ao', judgeIdx: number) => {
    handleScoreChange(side, judgeIdx, 0);
  };

  const handleDQ = async (side: 'aka' | 'ao', reason: string) => {
    const opponentSide = side === 'aka' ? 'ao' : 'aka';
    // Set all judge scores to 0.0 for DQ'd side
    const zeroScores = Object.fromEntries(Array.from({ length: numberOfJudges }, (_, i) => [i, 0]));
    if (side === 'aka') setAkaScores(zeroScores);
    else setAoScores(zeroScores);
    setIsDQ((prev) => ({ ...prev, [side]: true }));

    const patch: Record<string, any> = {
      [`isDQ.${side}`]: true,
      [`isDQ.${opponentSide}`]: false,
      kataWinner: opponentSide,
    };
    for (let i = 0; i < numberOfJudges; i++) {
      patch[`kataScores.${side}.${i}`] = 0;
    }
    await syncRTDB(patch);
    toast.success(`${side.toUpperCase()} disqualified. ${opponentSide.toUpperCase()} wins.`);
    setBoutFinished(true);
    setKataWinner(opponentSide);
    onMatchFinished(opponentSide, { aka: opponentSide === 'aka' ? numberOfJudges : 0, ao: opponentSide === 'ao' ? numberOfJudges : 0 });
  };

  const handleLogFoul = (side: 'aka' | 'ao', code: string) => {
    setFouls((prev) => ({ ...prev, [side]: [...prev[side], code] }));
    syncRTDB({ [`fouls.${side}`]: [...fouls[side], code] });
    toast.success(`Foul logged for ${side.toUpperCase()}: ${code}`);
  };

  const handleConfirmSelection = async () => {
    if (!selectedKata.aka || !selectedKata.ao) {
      toast.error('Select kata for both AKA and AO before starting.');
      return;
    }
    await syncRTDB({
      isKata: true,
      'selectedKata.aka': selectedKata.aka,
      'selectedKata.ao': selectedKata.ao,
      kataWinner: null,
      phase: 'kata',
    });
    setBoutStarted(true);
    if (isTeam) {
      setTeamTimer(300);
      setTimerWarning(false);
    }
    toast.success('Kata selections confirmed. Ready to score.');
  };

  const handleStartPerformance = () => {
    setTimerRunning(true);
    syncRTDB({ teamTimerSeconds: teamTimer, timerRunning: true });
  };

  const handleBeginBunkai = () => {
    setPhase('bunkai');
    syncRTDB({ phase: 'bunkai' });
    toast.success('Bunkai phase started.');
  };

  const handleFinishBout = async () => {
    // Validate all scores entered
    const akaEmpty = new Set<number>();
    const aoEmpty = new Set<number>();
    for (let i = 0; i < numberOfJudges; i++) {
      if (akaScores[i] === null) akaEmpty.add(i);
      if (aoScores[i] === null) aoEmpty.add(i);
    }
    if (akaEmpty.size > 0 || aoEmpty.size > 0) {
      setErrorCells({ aka: akaEmpty, ao: aoEmpty });
      toast.error(`Missing scores: ${akaEmpty.size + aoEmpty.size} cell(s) need values.`);
      return;
    }

    const votes = computeVotes(akaScores, aoScores, numberOfJudges);
    setVoteResult(votes);
    setBoutFinished(true);
    setTimerRunning(false);

    let winner: 'aka' | 'ao' | 'tie_pending';
    if (votes.aka > votes.ao) winner = 'aka';
    else if (votes.ao > votes.aka) winner = 'ao';
    else winner = 'tie_pending';

    setKataWinner(winner);

    // Build full RTDB payload
    const rtdbScoresAka: Record<string, number | null> = {};
    const rtdbScoresAo: Record<string, number | null> = {};
    for (let i = 0; i < numberOfJudges; i++) {
      rtdbScoresAka[i] = akaScores[i];
      rtdbScoresAo[i] = aoScores[i];
    }

    await syncRTDB({
      kataScores: { aka: rtdbScoresAka, ao: rtdbScoresAo },
      kataVotes: { aka: votes.aka, ao: votes.ao },
      kataWinner: winner,
      boutFinished: true,
    });

    if (winner === 'tie_pending') {
      setTieModalOpen(true);
      toast('Tie detected — resolution required.', { icon: <Scale size={16} /> });
    } else {
      onMatchFinished(winner, { aka: votes.aka, ao: votes.ao });
    }
  };

  const handleTieResolve = async (winner: 'aka' | 'ao', method: string) => {
    setTieModalOpen(false);
    setKataWinner(winner);
    await syncRTDB({ kataWinner: winner });
    toast.success(`${winner.toUpperCase()} wins via ${method}`);
    onMatchFinished(winner, voteResult ? { aka: voteResult.aka, ao: voteResult.ao } : { aka: 0, ao: 0 });
  };

  const handleCreateTieBreaker = async () => {
    setTieModalOpen(false);
    toast.loading('Creating tie-breaker bout...', { id: 'tb-create' });
    try {
      const res = await fetch(`/api/competitions/${competitionId}/brackets/${categoryId}/tiebreaker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Tie-breaker bout created in queue.', { id: 'tb-create' });
        // Setting kataWinner to 'tie' ends the bout without triggering typical match finish logic locally
        setKataWinner('tie' as any);
        await syncRTDB({ kataWinner: 'tie' });
      } else {
        toast.error(`Failed to create tie-breaker: ${data.error}`, { id: 'tb-create' });
      }
    } catch (err: any) {
      toast.error('Network error creating tie-breaker.', { id: 'tb-create' });
    }
  };

  const teamTimerMins = String(Math.floor(teamTimer / 60)).padStart(2, '0');
  const teamTimerSecs = String(teamTimer % 60).padStart(2, '0');

  const allJudgesFilled = (() => {
    for (let i = 0; i < numberOfJudges; i++) {
      if (akaScores[i] === null || aoScores[i] === null) return false;
    }
    return true;
  })();

  return (
    <>
      <style>{`
        @keyframes kata-slide-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .kata-panel-section {
          animation: kata-slide-in 0.22s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        .kata-btn {
          transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 160ms ease-out;
        }
        .kata-btn:active { transform: scale(0.97); }
        @media (prefers-reduced-motion: reduce) {
          .kata-panel-section { animation: none; }
          .kata-btn { transition: none; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── DISCIPLINE BADGE ── */}
        <div
          className="kata-panel-section"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: '10px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: boutFinished ? '#10b981' : boutStarted ? '#3b82f6' : '#f59e0b',
              flexShrink: 0,
            }}
          />
          <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e3a8a' }}>
            KATA · {numberOfJudges} Judges · {kataFormat === 'elimination' ? 'Elimination' : kataFormat === 'round-robin' ? 'Round-Robin' : 'Two-Pool'}
            {isTeam ? ' · Team' : ' · Individual'}
          </div>
          {boutStarted && !boutFinished && (
            <div style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: '#1d4ed8' }}>
              {phase === 'bunkai' ? 'BUNKAI PHASE' : 'KATA PHASE'}
            </div>
          )}
          {boutFinished && kataWinner && kataWinner !== 'tie_pending' && (
            <div
              style={{
                marginLeft: 'auto',
                padding: '3px 10px',
                borderRadius: '999px',
                background: kataWinner === 'aka' ? 'var(--aka)' : 'var(--ao)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {kataWinner === 'aka' ? akaName : aoName} Wins
            </div>
          )}
        </div>

        {/* ── TEAM TIMER ── */}
        {isTeam && boutStarted && !boutFinished && (
          <div
            className="kata-panel-section"
            style={{
              padding: '16px',
              background: timerWarning ? '#fef2f2' : 'var(--neutral-50)',
              border: `1.5px solid ${timerWarning ? 'var(--aka)' : 'var(--neutral-200)'}`,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              transition: 'background 0.4s ease, border-color 0.4s ease',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: timerWarning ? 'var(--aka)' : 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                Performance Timer
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '36px',
                  fontWeight: 800,
                  color: timerWarning ? 'var(--aka)' : 'var(--neutral-900)',
                  lineHeight: 1,
                }}
              >
                {teamTimerMins}:{teamTimerSecs}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="kata-btn"
                onClick={() => {
                  if (timerRunning) {
                    setTimerRunning(false);
                    syncRTDB({ timerRunning: false, teamTimerSeconds: teamTimer });
                  } else {
                    handleStartPerformance();
                  }
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: timerRunning ? 'var(--neutral-800)' : '#10b981',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {timerRunning ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Pause size={14} /> Pause</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Play size={14} /> Start</span>}
              </button>
              {phase === 'kata' ? (
                <button
                  type="button"
                  className="kata-btn"
                  onClick={handleBeginBunkai}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #6366f1',
                    background: 'transparent',
                    color: '#6366f1',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Begin Bunkai →
                </button>
              ) : (
                <div style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: '#6366f1',
                  fontWeight: 800,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  BUNKAI ACTIVE
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── KATA SELECTION ── */}
        {!boutStarted && (
          <div className="kata-panel-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--neutral-700)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Kata Selection
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <KataSelectionRow
                side="aka"
                allowedKataNumbers={allowedKataNumbers}
                selectedKata={selectedKata.aka}
                usageMap={akaUsageMap}
                onSelect={(kata) => setSelectedKata((prev) => ({ ...prev, aka: kata }))}
              />
              <KataSelectionRow
                side="ao"
                allowedKataNumbers={allowedKataNumbers}
                selectedKata={selectedKata.ao}
                usageMap={aoUsageMap}
                onSelect={(kata) => setSelectedKata((prev) => ({ ...prev, ao: kata }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="kata-btn"
                disabled={!selectedKata.aka || !selectedKata.ao}
                onClick={handleConfirmSelection}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: selectedKata.aka && selectedKata.ao ? 'var(--neutral-900)' : 'var(--neutral-200)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: selectedKata.aka && selectedKata.ao ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.04em',
                }}
              >
                Confirm Selections →
              </button>
            </div>
          </div>
        )}

        {/* ── SCORE GRID ── */}
        {boutStarted && (
          <div className="kata-panel-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Selected kata chips */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {selectedKata.aka && (
                <div style={{ padding: '4px 10px', background: 'rgba(217,38,44,0.08)', border: '1px solid rgba(217,38,44,0.2)', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--aka)' }}>
                  AKA: #{selectedKata.aka.number} {selectedKata.aka.name}
                </div>
              )}
              {selectedKata.ao && (
                <div style={{ padding: '4px 10px', background: 'rgba(26,77,181,0.08)', border: '1px solid rgba(26,77,181,0.2)', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--ao)' }}>
                  AO: #{selectedKata.ao.number} {selectedKata.ao.name}
                </div>
              )}
            </div>

            <JudgeScoreGrid
              numberOfJudges={numberOfJudges}
              scores={{ aka: akaScores, ao: aoScores }}
              isDQ={isDQ}
              finished={boutFinished}
              errorCells={errorCells}
              onScoreChange={handleScoreChange}
              onDQJudge={handleDQJudge}
            />

            {/* Vote summary after finish */}
            {boutFinished && voteResult && (
              <div
                style={{
                  padding: '16px',
                  background: kataWinner === 'tie_pending' ? '#fffbeb' : kataWinner === 'aka' ? 'rgba(217,38,44,0.06)' : 'rgba(26,77,181,0.06)',
                  border: `2px solid ${kataWinner === 'tie_pending' ? '#fbbf24' : kataWinner === 'aka' ? 'var(--aka)' : 'var(--ao)'}`,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  animation: 'kata-slide-in 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--neutral-500)', marginBottom: '4px' }}>
                    Final Vote Count
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 800, color: 'var(--aka)' }}>
                      AKA {voteResult.aka}
                    </span>
                    <span style={{ fontSize: '18px', color: 'var(--neutral-400)', fontWeight: 700 }}>–</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 800, color: 'var(--ao)' }}>
                      {voteResult.ao} AO
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: kataWinner === 'tie_pending' ? '#b45309' : kataWinner === 'aka' ? 'var(--aka)' : 'var(--ao)' }}>
                    {kataWinner === 'tie_pending' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Scale size={14} /> Tie</span> : kataWinner === 'aka' ? `${akaName} Wins` : `${aoName} Wins`}
                  </div>
                  {voteResult.tied.length > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--neutral-500)', marginTop: '2px' }}>
                      {voteResult.tied.length} tied judge{voteResult.tied.length > 1 ? 's' : ''} (J{voteResult.tied.map((j) => j + 1).join(', J')})
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Finish button */}
            {!boutFinished && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="kata-btn"
                  onClick={handleFinishBout}
                  style={{
                    padding: '10px 28px',
                    borderRadius: '8px',
                    border: 'none',
                    background: allJudgesFilled ? 'var(--neutral-900)' : 'var(--neutral-300)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: allJudgesFilled ? 'pointer' : 'default',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Finish Bout
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── FOUL PANEL ── */}
        {boutStarted && (
          <div className="kata-panel-section">
            <FoulPanel fouls={fouls} onLogFoul={handleLogFoul} disabled={boutFinished} />
          </div>
        )}

        {/* ── DQ PANEL ── */}
        {boutStarted && !boutFinished && (
          <div className="kata-panel-section">
            <DQPanel
              isDQ={isDQ}
              akaName={akaName}
              aoName={aoName}
              onDQ={handleDQ}
            />
          </div>
        )}
      </div>

      {/* ── TIE RESOLUTION MODAL ── */}
      <TieResolutionModal
        isOpen={tieModalOpen}
        akaName={akaName}
        aoName={aoName}
        kataFormat={kataFormat}
        isTeam={isTeam}
        onResolve={handleTieResolve}
        onCreateTieBreaker={handleCreateTieBreaker}
        onClose={() => setTieModalOpen(false)}
      />
    </>
  );
}
