'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Scale } from 'lucide-react';
import KataSelectionRow from './KataSelectionRow';
import FoulPanel from './FoulPanel';
import DQPanel from './DQPanel';
import TieResolutionModal from './TieResolutionModal';
import { KATA_LIST, KataEntry } from '@/lib/kata-list';
import { deriveJudgeVotes } from './KataLiveScoreboard';

interface Props {
  competitionId: string;
  categoryId: string;
  matchId: string;
  matId: string;
  akaName: string;
  aoName: string;
  akaAcademy?: string;
  aoAcademy?: string;
  akaId?: string;
  aoId?: string;
  numberOfJudges: number;
  allowedKataNumbers: number[];
  kataFormat: 'elimination' | 'round-robin' | 'two-pool';
  isTeam?: boolean;
  onMatchFinished: (winner: 'aka' | 'ao', voteCount: { aka: number; ao: number }, selectedKata?: { aka: KataEntry | null; ao: KataEntry | null }) => void;
  onClose?: () => void;
}

// ─── Flag SVG ───────────────────────────────────────────────────────────────────
const FlagIcon = ({ color, size = 22 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12z" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="4" y1="22" x2="4" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function KataOperatorPanel({
  competitionId,
  categoryId,
  matchId,
  matId,
  akaName,
  aoName,
  akaAcademy,
  aoAcademy,
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

  const [boutStarted, setBoutStarted] = useState(true);
  const [boutFinished, setBoutFinished] = useState(false);

  // Live judge votes from RTDB (flag model: 1=voted for that side, 0=not)
  const [liveVotes, setLiveVotes] = useState<{ aka: Record<string, number>; ao: Record<string, number> } | null>(null);

  const [isDQ, setIsDQ] = useState<{ aka: boolean; ao: boolean }>({ aka: false, ao: false });
  const [fouls, setFouls] = useState<{ aka: string[]; ao: string[] }>({ aka: [], ao: [] });

  const [voteResult, setVoteResult] = useState<{ aka: number; ao: number; tied: number[] } | null>(null);
  const [kataWinner, setKataWinner] = useState<'aka' | 'ao' | 'tie_pending' | null>(null);

  const [tieModalOpen, setTieModalOpen] = useState(false);

  // Reveal countdown state
  const [revealing, setRevealing] = useState(false);

  // Kata Stopwatch
  const [teamTimer, setTeamTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Rest Timer
  const [restTimer, setRestTimer] = useState(0);
  const [restRunning, setRestRunning] = useState(false);

  // ─── Sync to RTDB ─────────────────────────────────────────────────────────────
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

  const startRevealCountdown = async () => {
    const { judgeVotes } = deriveJudgeVotes(liveVotes, numberOfJudges);
    const votedCount = judgeVotes.filter((v) => v !== null).length;
    if (votedCount < numberOfJudges) {
      const missing = numberOfJudges - votedCount;
      toast.error(`${missing} judge${missing > 1 ? 's' : ''} haven't voted yet.`);
      return;
    }

    setRevealing(true);
    let count = 3;
    await syncRTDB({ revealCountdown: count, revealVotes: false });

    const interval = setInterval(async () => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setRevealing(false);
        await syncRTDB({ revealCountdown: 0, revealVotes: true });
        handleFinishBout();
      } else {
        await syncRTDB({ revealCountdown: count });
      }
    }, 1000);
  };

  // Auto-sync rest timer to RTDB when updated
  useEffect(() => {
    syncRTDB({
      restTimerSeconds: restTimer,
      restTimerRunning: restRunning,
    });
  }, [restTimer, restRunning, syncRTDB]);

  // Auto-sync performance timer to RTDB when updated
  useEffect(() => {
    syncRTDB({
      teamTimerSeconds: teamTimer,
      timerRunning: timerRunning,
    });
  }, [teamTimer, timerRunning, syncRTDB]);

  const handleKataSelect = async (side: 'aka' | 'ao', kata: KataEntry | null) => {
    const nextSelected = { ...selectedKata, [side]: kata };
    setSelectedKata(nextSelected);

    // Save to Firestore (fire-and-forget)
    fetch(`/api/competitions/${competitionId}/brackets/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, selectedKata: nextSelected }),
    }).catch((e) => console.error('Failed to save kata selection', e));

    // Save to RTDB and clear any previous bout state for this match
    await syncRTDB({
      isKata: true,
      'selectedKata/aka': nextSelected.aka,
      'selectedKata/ao': nextSelected.ao,
      kataWinner: null,
      boutFinished: false,
      kataScores: null,
      kataVotes: null,
      revealVotes: false,
      revealCountdown: 0,
    });
  };

  // ─── Live vote listener ────────────────────────────────────────────────────────
  useEffect(() => {
    let unsub: () => void = () => {};
    const setup = async () => {
      try {
        const { rtdb } = await import('@lib/firebase');
        const { ref, onValue, off } = await import('firebase/database');
        const r = ref(rtdb, `live_scores/${competitionId}/mats/${matId}`);
        const handler = onValue(r, (snap) => {
          if (!snap.exists()) return;
          const d = snap.val();
          if (d.matchId === matchId) {
            if (d.kataScores) setLiveVotes(d.kataScores);
            if (d.selectedKata && !boutStarted) {
              setSelectedKata(d.selectedKata);
            }
            if (d.boutFinished && !boutFinished) setBoutFinished(true);
            if (d.kataWinner) setKataWinner(d.kataWinner);
            if (d.fouls) setFouls({ aka: d.fouls.aka || [], ao: d.fouls.ao || [] });
            if (d.isDQ) setIsDQ({ aka: !!d.isDQ.aka, ao: !!d.isDQ.ao });
            if (d.kataVotes) setVoteResult({ aka: d.kataVotes.aka, ao: d.kataVotes.ao, tied: [] });
          }
        });
        unsub = () => off(r, 'value', handler);
      } catch (err) {
        console.error('Failed to listen to kata RTDB', err);
      }
    };
    setup();
    return () => unsub();
  }, [competitionId, matId, matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Hydrate from RTDB on mount ───────────────────────────────────────────────
  useEffect(() => {
    const hydrate = async () => {
      try {
        const { rtdb } = await import('@lib/firebase');
        const { ref, get } = await import('firebase/database');
        const r = ref(rtdb, `live_scores/${competitionId}/mats/${matId}`);
        const snap = await get(r);
        if (snap.exists()) {
          const d = snap.val();
          if (d.matchId === matchId && d.isKata) {
            if (d.selectedKata) {
              setSelectedKata(d.selectedKata);
              setBoutStarted(true);
            }
            if (d.boutFinished) setBoutFinished(true);
            if (d.kataWinner) setKataWinner(d.kataWinner);
            if (d.kataScores) setLiveVotes(d.kataScores);
            if (d.fouls) setFouls({ aka: d.fouls.aka || [], ao: d.fouls.ao || [] });
            if (d.isDQ) setIsDQ({ aka: !!d.isDQ.aka, ao: !!d.isDQ.ao });
            if (d.kataVotes) setVoteResult({ aka: d.kataVotes.aka, ao: d.kataVotes.ao, tied: [] });
          }
        }
      } catch (err) {
        console.error('Failed to hydrate Kata state', err);
      }
    };
    hydrate();
  }, [competitionId, matId, matchId]);

  // ─── Load kata usage history ───────────────────────────────────────────────────
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

  // ─── Stopwatch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerRunning) return;
    const t = setInterval(() => setTeamTimer((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [timerRunning]);

  // ─── Rest Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restRunning || restTimer <= 0) return;
    const t = setInterval(() => setRestTimer((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [restRunning, restTimer]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleJudgeCardClick = async (judgeIndex: number) => {
    if (boutFinished) return;
    const currentVote = judgeVotes[judgeIndex];
    let nextVote: 'aka' | 'ao' | null = null;
    if (currentVote === null) nextVote = 'aka';
    else if (currentVote === 'aka') nextVote = 'ao';
    else nextVote = null;

    await syncRTDB({
      [`kataScores/aka/${judgeIndex}`]: nextVote === 'aka' ? 1 : 0,
      [`kataScores/ao/${judgeIndex}`]: nextVote === 'ao' ? 1 : 0,
    });
  };

  const handleDQ = async (side: 'aka' | 'ao', reason: string) => {
    const opponentSide = side === 'aka' ? 'ao' : 'aka';
    setIsDQ((prev) => ({ ...prev, [side]: true }));

    // Give all votes to opponent
    const fullVotesAka: Record<string, number> = {};
    const fullVotesAo: Record<string, number> = {};
    for (let i = 0; i < numberOfJudges; i++) {
      fullVotesAka[String(i)] = opponentSide === 'aka' ? 1 : 0;
      fullVotesAo[String(i)] = opponentSide === 'ao' ? 1 : 0;
    }

    const patch: Record<string, any> = {
      [`isDQ/${side}`]: true,
      [`isDQ/${opponentSide}`]: false,
      kataWinner: opponentSide,
      boutFinished: true,
      'kataScores/aka': fullVotesAka,
      'kataScores/ao': fullVotesAo,
      kataVotes: { aka: opponentSide === 'aka' ? numberOfJudges : 0, ao: opponentSide === 'ao' ? numberOfJudges : 0 },
    };
    await syncRTDB(patch);
    toast.success(`${side.toUpperCase()} disqualified. ${opponentSide.toUpperCase()} wins.`);
    setBoutFinished(true);
    setKataWinner(opponentSide);
    onMatchFinished(opponentSide, { aka: opponentSide === 'aka' ? numberOfJudges : 0, ao: opponentSide === 'ao' ? numberOfJudges : 0 }, selectedKata);
  };

  const handleLogFoul = (side: 'aka' | 'ao', code: string) => {
    const next = [...fouls[side], code];
    setFouls((prev) => ({ ...prev, [side]: next }));
    syncRTDB({ [`fouls/${side}`]: next });
    toast.success(`Foul logged for ${side.toUpperCase()}: ${code}`);
  };



  const handleFinishBout = async () => {
    // Derive votes from live RTDB data
    const { judgeVotes, akaFlags, aoFlags } = deriveJudgeVotes(liveVotes, numberOfJudges);

    const votedCount = judgeVotes.filter((v) => v !== null).length;
    if (votedCount < numberOfJudges) {
      const missing = numberOfJudges - votedCount;
      toast.error(`${missing} judge${missing > 1 ? 's' : ''} haven't voted yet.`);
      return;
    }

    const tiedJudges = judgeVotes.reduce<number[]>((acc, v, i) => (v === 'tie' ? [...acc, i] : acc), []);
    const votes = { aka: akaFlags, ao: aoFlags, tied: tiedJudges };
    setVoteResult(votes);
    setBoutFinished(true);
    setTimerRunning(false);

    let winner: 'aka' | 'ao' | 'tie_pending';
    if (akaFlags > aoFlags) winner = 'aka';
    else if (aoFlags > akaFlags) winner = 'ao';
    else winner = 'tie_pending';

    setKataWinner(winner);

    await syncRTDB({
      kataVotes: { aka: akaFlags, ao: aoFlags },
      kataWinner: winner,
      boutFinished: true,
      revealVotes: true,
      revealCountdown: 0,
    });

    if (winner === 'tie_pending') {
      toast('Tie detected — requesting revote.', { icon: <Scale size={16} /> });
    } else {
      onMatchFinished(winner, { aka: akaFlags, ao: aoFlags }, selectedKata);
    }
  };

  const handleRequestRevote = async () => {
    setVoteResult(null);
    setKataWinner(null);
    setBoutFinished(false);
    setLiveVotes(null);

    await syncRTDB({
      kataScores: null,
      kataVotes: null,
      kataWinner: null,
      boutFinished: false,
      revealVotes: false,
      revealCountdown: 0,
    });
    toast.success('Revote requested. Judges can now vote again.');
  };

  const handleCreateTieBreaker = async () => {
    setTieModalOpen(false);
    toast.loading('Creating tie-breaker bout...', { id: 'tb-create' });
    try {
      const res = await fetch(`/api/competitions/${competitionId}/brackets/${categoryId}/tiebreaker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Tie-breaker bout created in queue.', { id: 'tb-create' });
        setKataWinner('tie' as any);
        await syncRTDB({ kataWinner: 'tie' });
      } else {
        toast.error(`Failed to create tie-breaker: ${data.error}`, { id: 'tb-create' });
      }
    } catch {
      toast.error('Network error creating tie-breaker.', { id: 'tb-create' });
    }
  };

  // ─── Derived display data ──────────────────────────────────────────────────────
  const { judgeVotes, akaFlags, aoFlags } = deriveJudgeVotes(liveVotes, numberOfJudges);
  const allJudgesVoted = judgeVotes.every((v) => v !== null);

  const teamTimerMins = String(Math.floor(teamTimer / 60)).padStart(2, '0');
  const teamTimerSecs = String(teamTimer % 60).padStart(2, '0');

  return (
    <>
      <style>{`
        @keyframes kata-slide-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes kata-pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .kata-panel-section {
          animation: kata-slide-in 0.22s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        .kata-btn {
          transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 160ms ease-out;
        }
        .kata-btn:active { transform: scale(0.97); }
        .kata-judge-card {
          transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .kata-panel-section { animation: none; }
          .kata-btn { transition: none; }
          .kata-judge-card { transition: none; }
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
              animation: boutStarted && !boutFinished ? 'kata-pulse-dot 1.5s ease-in-out infinite' : 'none',
            }}
          />
          <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e3a8a' }}>
            KATA · {numberOfJudges} Judges · {kataFormat === 'elimination' ? 'Elimination' : kataFormat === 'round-robin' ? 'Round-Robin' : 'Two-Pool'}
            {isTeam ? ' · Team' : ' · Individual'}
          </div>
          {boutStarted && !boutFinished && (
            <div style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: '#1d4ed8' }}>
              VOTING OPEN
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

        {/* ── KATA SELECTION ── */}
        <div className="kata-panel-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--neutral-700)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Kata Selection
          </div>
          <div className="flex-col-mobile" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <KataSelectionRow
              side="aka"
              playerName={akaName}
              academy={akaAcademy}
              allowedKataNumbers={allowedKataNumbers}
              selectedKata={selectedKata.aka}
              usageMap={akaUsageMap}
              onSelect={(kata) => handleKataSelect('aka', kata)}
              disabled={boutFinished}
            />
            <KataSelectionRow
              side="ao"
              playerName={aoName}
              academy={aoAcademy}
              allowedKataNumbers={allowedKataNumbers}
              selectedKata={selectedKata.ao}
              usageMap={aoUsageMap}
              onSelect={(kata) => handleKataSelect('ao', kata)}
              disabled={boutFinished}
            />
          </div>
        </div>

        {/* ── PERFORMANCE STOPWATCH ── */}
        {boutStarted && !boutFinished && (
          <div
            className="kata-panel-section flex-col-mobile"
            style={{
              padding: '16px',
              background: 'var(--neutral-50)',
              border: '1.5px solid var(--neutral-200)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                Performance Timer
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '36px',
                  fontWeight: 800,
                  color: 'var(--neutral-900)',
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
                onClick={() => setTimerRunning(!timerRunning)}
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
                {timerRunning ? '⏸ Stop Timer' : '▶ Start Timer'}
              </button>
            </div>

            <div style={{ height: '40px', width: '1px', background: 'var(--neutral-300)', margin: '0 8px' }} />

            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                Rest Timer
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {restRunning && restTimer > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 800, color: '#f59e0b', minWidth: '40px', textAlign: 'center' }}>
                      {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
                    </span>
                    <button type="button" className="kata-btn" onClick={() => { setRestRunning(false); setRestTimer(0); }} style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--neutral-200)', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Stop</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" className="kata-btn" onClick={() => { setRestTimer(30); setRestRunning(true); }} style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>30s</button>
                    <button type="button" className="kata-btn" onClick={() => { setRestTimer(60); setRestRunning(true); }} style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>60s</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LIVE JUDGE VOTE DISPLAY ── */}
        {boutStarted && (
          <div className="kata-panel-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Selected kata chips */}
            <div className="flex-col-mobile" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
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
              {/* Running tally */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 800, color: 'var(--aka)' }}>{akaFlags}</span>
                <span style={{ fontSize: '12px', color: 'var(--neutral-400)', fontWeight: 700 }}>vs</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 800, color: 'var(--ao)' }}>{aoFlags}</span>
              </div>
            </div>

            {/* Judge vote cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(numberOfJudges, 7)}, 1fr)`,
                gap: '8px',
              }}
            >
              {judgeVotes.map((vote, i) => (
                <div
                  key={i}
                  className="kata-judge-card"
                  onClick={() => handleJudgeCardClick(i)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 8px',
                    background:
                      vote === 'aka'
                        ? 'rgba(217,38,44,0.06)'
                         : vote === 'ao'
                        ? 'rgba(26,77,181,0.06)'
                        : 'var(--neutral-50)',
                    border: `2px solid ${
                      vote === 'aka'
                        ? 'rgba(217,38,44,0.25)'
                        : vote === 'ao'
                        ? 'rgba(26,77,181,0.25)'
                        : 'var(--neutral-200)'
                    }`,
                    borderRadius: '10px',
                    cursor: !boutFinished ? 'pointer' : 'default',
                    boxShadow:
                      vote === 'aka'
                        ? '0 4px 12px rgba(217,38,44,0.1)'
                        : vote === 'ao'
                        ? '0 4px 12px rgba(26,77,181,0.1)'
                        : 'none',
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    J{i + 1}
                  </div>
                  {vote === null ? (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: '2px dashed var(--neutral-300)',
                        animation: boutStarted && !boutFinished ? 'kata-pulse-dot 2s ease-in-out infinite' : 'none',
                      }}
                    />
                  ) : vote === 'aka' ? (
                    <FlagIcon color="var(--aka)" size={22} />
                  ) : vote === 'ao' ? (
                    <FlagIcon color="var(--ao)" size={22} />
                  ) : (
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>TIE</div>
                  )}
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color:
                        vote === 'aka'
                          ? 'var(--aka)'
                          : vote === 'ao'
                          ? 'var(--ao)'
                          : vote === 'tie'
                          ? '#d97706'
                          : 'var(--neutral-400)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {vote ?? 'wait'}
                  </div>
                </div>
              ))}
            </div>

            {/* Vote summary after finish */}
            {boutFinished && voteResult && (
              <div
                style={{
                  padding: '16px',
                  background:
                    kataWinner === 'tie_pending'
                      ? '#fffbeb'
                      : kataWinner === 'aka'
                      ? 'rgba(217,38,44,0.06)'
                      : 'rgba(26,77,181,0.06)',
                  border: `2px solid ${
                    kataWinner === 'tie_pending'
                      ? '#fbbf24'
                      : kataWinner === 'aka'
                      ? 'var(--aka)'
                      : 'var(--ao)'
                  }`,
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
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      color:
                        kataWinner === 'tie_pending'
                          ? '#b45309'
                          : kataWinner === 'aka'
                          ? 'var(--aka)'
                          : 'var(--ao)',
                    }}
                  >
                    {kataWinner === 'tie_pending' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Scale size={14} /> Tie
                      </span>
                    ) : kataWinner === 'aka' ? (
                      `${akaName} Wins`
                    ) : (
                      `${aoName} Wins`
                    )}
                  </div>
                  {kataWinner === 'tie_pending' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={handleRequestRevote}
                        className="kata-btn"
                        style={{
                          padding: '8px 16px',
                          background: '#d97706',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                        }}
                      >
                        Request Revote
                      </button>
                      <button
                        onClick={() => setTieModalOpen(true)}
                        className="kata-btn"
                        style={{
                          padding: '8px 16px',
                          background: 'var(--neutral-800)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                        }}
                      >
                        Tie-Breaker Bout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Finish button */}
            {!boutFinished && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                {!allJudgesVoted && (
                  <span style={{ fontSize: '12px', color: 'var(--neutral-500)', fontWeight: 600 }}>
                    {judgeVotes.filter((v) => v !== null).length}/{numberOfJudges} judges voted
                  </span>
                )}
                
                {allJudgesVoted && (
                  <button
                    type="button"
                    className="kata-btn"
                    onClick={startRevealCountdown}
                    disabled={revealing}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--ao)',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {revealing ? 'Revealing...' : '⏱ Reveal & Finish (3s)'}
                  </button>
                )}

                <button
                  type="button"
                  className="kata-btn"
                  onClick={handleFinishBout}
                  disabled={revealing || !allJudgesVoted}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--neutral-300)',
                    background: '#fff',
                    color: allJudgesVoted ? 'var(--neutral-850)' : 'var(--neutral-400)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: allJudgesVoted ? 'pointer' : 'default',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Reveal Instantly
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

      {/* ── TIE MODAL ── */}
      <TieResolutionModal
        isOpen={tieModalOpen}
        onClose={() => setTieModalOpen(false)}
        onCreateTieBreaker={handleCreateTieBreaker}
        onResolve={(winner) => {
          setTieModalOpen(false);
          setKataWinner(winner);
          setBoutFinished(true);
          syncRTDB({ kataWinner: winner, boutFinished: true });
          onMatchFinished(winner, { aka: voteResult?.aka ?? 0, ao: voteResult?.ao ?? 0 }, selectedKata);
        }}
        akaName={akaName}
        aoName={aoName}
        kataFormat={kataFormat}
        isTeam={isTeam}
      />
    </>
  );
}
