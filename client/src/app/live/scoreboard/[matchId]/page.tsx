'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Maximize2, X, Play, Pause, RotateCcw, Coffee } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import KataLiveScoreboard, { deriveJudgeVotes } from '@/components/kata/KataLiveScoreboard';
import KumiteLiveScoreboard from '@/components/kumite/KumiteLiveScoreboard';
import ScaleWrapper from '@/components/ScaleWrapper';

type FighterState = {
  name: string;
  country: string;
  academy: string;
  score: number;
  ippon: number;
  wazaari: number;
  yuko: number;
  c1: number;
  c2: number;
  c3: number;
  hc: number;
  h: number;
  senshu: boolean;
};

export default function ScoreboardPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = React.use(params);

  const initialFighterState = (name: string, country: string = 'JAPAN', academy: string = ''): FighterState => ({
    name, country, academy, score: 0, ippon: 0, wazaari: 0, yuko: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false
  });

  const [aka, setAka] = useState<FighterState>(initialFighterState('SATO', 'JPN', 'Kyoto Martial Academy'));
  const [ao, setAo] = useState<FighterState>(initialFighterState('MULLER', 'GER', 'Berlin Karate Club'));
  
  const [timer, setTimer] = useState(180);
  const [running, setRunning] = useState(false);
  const [senshuClaimed, setSenshuClaimed] = useState(false);
  
  // ─── Rest Timer State ────────────────────────────────────────────
  const [restTimer, setRestTimer] = useState(0);
  const [restRunning, setRestRunning] = useState(false);

  // Rest timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (restRunning && restTimer > 0) {
      interval = setInterval(() => setRestTimer(t => t - 1), 1000);
    } else if (restRunning && restTimer <= 0) {
      setRestRunning(false);
    }
    return () => clearInterval(interval);
  }, [restRunning, restTimer]);

  const startRest = useCallback((seconds: number) => {
    setRestTimer(seconds);
    setRestRunning(true);
  }, []);

  const formatRestTime = (t: number) => {
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    const s = (t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const [winnerOverlay, setWinnerOverlay] = useState<{ active: boolean, winner: string, classMode: string }>({
    active: false, winner: '', classMode: ''
  });
  
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean; title: string; message: string; isDestructive: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', isDestructive: false, onConfirm: () => {} });

  const closeConfirm = () => setConfirmState(prev => ({ ...prev, isOpen: false }));

  // RTDB listener for live data (when connected to a real competition)
  const [rtdbData, setRtdbData] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const setup = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const competitionId = params.get('competition');
        const matId = params.get('mat');
        if (!competitionId || !matId) {
          setIsConnecting(false);
          return; // No RTDB params, stay in demo mode
        }

        const { ref, onValue } = await import('firebase/database');
        const { rtdb } = await import('@lib/firebase');
        const matRef = ref(rtdb, `live_scores/${competitionId}/mats/${matId}`);
        unsubscribe = onValue(matRef, (snapshot) => {
          setRtdbData(snapshot.val());
          setIsConnecting(false);
        });
      } catch (err) {
        console.error('Scoreboard RTDB setup failed:', err);
        setIsConnecting(false);
      }
    };
    setup();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [matchId]);

  // Hydrate local state from RTDB kumite data (when connected to real competition)
  useEffect(() => {
    if (!rtdbData || rtdbData.isKata) return;
    
    // Update AKA state from RTDB
    setAka(prev => ({
      ...prev,
      name: rtdbData.akaName || prev.name,
      country: rtdbData.akaCountry || prev.country,
      academy: rtdbData.akaAcademy || prev.academy,
      score: rtdbData.scores?.aka ?? prev.score,
      ippon: rtdbData.akaStats?.ippon ?? prev.ippon,
      wazaari: rtdbData.akaStats?.waza ?? prev.wazaari,
      yuko: rtdbData.akaStats?.yuko ?? prev.yuko,
      c1: rtdbData.akaPenalties?.c1 ?? prev.c1,
      c2: rtdbData.akaPenalties?.c2 ?? prev.c2,
      c3: rtdbData.akaPenalties?.c3 ?? prev.c3,
      hc: rtdbData.akaPenalties?.hc ?? prev.hc,
      h: rtdbData.akaPenalties?.h ?? prev.h,
      senshu: rtdbData.akaStats?.senshu ?? prev.senshu,
    }));
    
    // Update AO state from RTDB
    setAo(prev => ({
      ...prev,
      name: rtdbData.aoName || prev.name,
      country: rtdbData.aoCountry || prev.country,
      academy: rtdbData.aoAcademy || prev.academy,
      score: rtdbData.scores?.ao ?? prev.score,
      ippon: rtdbData.aoStats?.ippon ?? prev.ippon,
      wazaari: rtdbData.aoStats?.waza ?? prev.wazaari,
      yuko: rtdbData.aoStats?.yuko ?? prev.yuko,
      c1: rtdbData.aoPenalties?.c1 ?? prev.c1,
      c2: rtdbData.aoPenalties?.c2 ?? prev.c2,
      c3: rtdbData.aoPenalties?.c3 ?? prev.c3,
      hc: rtdbData.aoPenalties?.hc ?? prev.hc,
      h: rtdbData.aoPenalties?.h ?? prev.h,
      senshu: rtdbData.aoStats?.senshu ?? prev.senshu,
    }));

    // Update timer from RTDB
    if (rtdbData.timerSeconds !== undefined) {
      setTimer(rtdbData.timerSeconds);
    }
    if (rtdbData.timerRunning !== undefined) {
      setRunning(rtdbData.timerRunning);
    }
    if (rtdbData.akaStats?.senshu || rtdbData.aoStats?.senshu) {
      setSenshuClaimed(true);
    }
  }, [rtdbData]);

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (running && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else if (running && timer === 0) {
      setRunning(false);
      showWinner();
    }
    return () => clearInterval(interval);
  }, [running, timer]);

  const addPoint = useCallback((side: 'aka' | 'ao', points: number) => {
    const isAka = side === 'aka';
    const setter = isAka ? setAka : setAo;
    
    setter(prev => {
      const next = { ...prev };
      if (points === 3) next.ippon++;
      if (points === 2) next.wazaari++;
      if (points === 1) next.yuko++;
      next.score += points;

      if (!senshuClaimed && points > 0) {
        next.senshu = true;
        setSenshuClaimed(true);
      }
      return next;
    });

    // We skip the specific dom animations here in React favor, but can keep it simple.
  }, [senshuClaimed]);

  const addPenalty = useCallback((side: 'aka' | 'ao', type: 'c1' | 'c2') => {
    const isAka = side === 'aka';
    const setter = isAka ? setAka : setAo;
    
    setter(prev => {
      if (prev[type] < 4) {
        return { ...prev, [type]: prev[type] + 1 };
      }
      return prev;
    });
  }, []);

  const toggleTimer = useCallback(() => {
    setRunning(prev => !prev);
  }, []);

  const showWinner = useCallback(() => {
    let winnerName = 'DRAW';
    let classMode = '';

    if (aka.score > ao.score) {
      winnerName = aka.name;
      classMode = 'winner-aka';
    } else if (ao.score > aka.score) {
      winnerName = ao.name;
      classMode = 'winner-ao';
    } else if (aka.senshu) {
      winnerName = aka.name;
      classMode = 'winner-aka';
    } else if (ao.senshu) {
      winnerName = ao.name;
      classMode = 'winner-ao';
    }

    setWinnerOverlay({ active: true, winner: winnerName, classMode });
  }, [aka, ao]);

  const resetAll = useCallback(() => {
    setConfirmState({
      isOpen: true,
      title: 'Reset Scoreboard',
      message: 'Reset scoreboard?',
      isDestructive: true,
      onConfirm: () => {
        closeConfirm();
        setAka(initialFighterState('SATO', 'JPN', 'Kyoto Martial Academy'));
        setAo(initialFighterState('MULLER', 'GER', 'Berlin Karate Club'));
        setTimer(180);
        setRunning(false);
        setSenshuClaimed(false);
        setWinnerOverlay({ active: false, winner: '', classMode: '' });
      }
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      if (!e.shiftKey) {
        if (key === '1') addPoint('aka', 1);
        if (key === '2') addPoint('aka', 2);
        if (key === '3') addPoint('aka', 3);
        if (key === 'q') addPoint('ao', 1);
        if (key === 'w') addPoint('ao', 2);
        if (key === 'e') addPoint('ao', 3);
      } else {
        if (key === '!') addPenalty('aka', 'c1');
        if (key === '@') addPenalty('aka', 'c2'); // handling 'shift+2' which is @
        if (key === '"') addPenalty('aka', 'c2'); // UK keyboard shift+2
        if (key === 'q') addPenalty('ao', 'c1');
        if (key === 'w') addPenalty('ao', 'c2');
      }

      if (e.code === 'Space') {
        e.preventDefault();
        toggleTimer();
      }

      if (key === 'r') resetAll();
      if (key === 'f') toggleFullscreen();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Eslint might warn, but this is a global keydown handler where we want stable bindings or use refs if needed. Since we use functional state updates, the stale closure risk is minimal.

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    const s = (t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderDots = (count: number) => {
    return Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className={`dot ${i < count ? 'active' : ''}`}></div>
    ));
  };

  // If RTDB data indicates this is a Kata match, render KataLiveScoreboard
  if (rtdbData?.isKata) {
    const nJudges = rtdbData.numberOfJudges || 3;
    const { judgeVotes, akaFlags, aoFlags } = deriveJudgeVotes(rtdbData.kataScores, nJudges);
    return (
      <ScaleWrapper>
        <KataLiveScoreboard
          akaName={rtdbData.akaName || 'AKA'}
          aoName={rtdbData.aoName || 'AO'}
          akaAcademy={rtdbData.akaAcademy}
          aoAcademy={rtdbData.aoAcademy}
          akaCountry={rtdbData.akaCountry}
          aoCountry={rtdbData.aoCountry}
          akaKataName={rtdbData.selectedKata?.aka?.name}
          aoKataName={rtdbData.selectedKata?.ao?.name}
          numberOfJudges={nJudges}
          judgeVotes={judgeVotes}
          akaFlags={rtdbData.kataVotes?.aka ?? akaFlags}
          aoFlags={rtdbData.kataVotes?.ao ?? aoFlags}
          timeRemaining={rtdbData.timeRemaining || formatTime(timer)}
          matchStatus={rtdbData.status === 'live' ? 'LIVE' : (rtdbData.status || 'STANDBY').toUpperCase()}
          title={`TAIKAIX — SCOREBOARD`}
          subtitle={rtdbData.currentCategory || 'KATA'}
          kataWinner={rtdbData.kataWinner}
          winnerName={rtdbData.kataWinner === 'aka' ? rtdbData.akaName : rtdbData.kataWinner === 'ao' ? rtdbData.aoName : undefined}
          onToggleFullscreen={toggleFullscreen}
        />
      </ScaleWrapper>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--kuro)', color: 'var(--shiro)', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .controls-overlay { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); padding: var(--space-4) var(--space-6); border-radius: 100px; display: flex; gap: var(--space-6); border: 1px solid var(--neutral-700); opacity: 0; pointer-events: none; transition: all 0.3s ease; z-index: 100; }
        body:hover .controls-overlay { opacity: 1; pointer-events: auto; }
        .control-group { display: flex; align-items: center; gap: var(--space-3); }
        .control-btn { background: var(--neutral-900); border: 1px solid var(--neutral-700); color: var(--shiro); padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s ease; }
        .control-btn:hover { background: var(--neutral-700); transform: translateY(-1px); }
        .key-hint { font-size: 10px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: var(--neutral-300); }
        .fullscreen-btn { position: fixed; top: 24px; right: 24px; z-index: 100; background: rgba(0,0,0,0.5); border: 1px solid var(--neutral-700); color: var(--shiro); padding: 8px; border-radius: 8px; cursor: pointer; }
      `}} />

      {/* REST TIMER OVERLAY */}
      {restRunning && restTimer > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(0,0,0,0.85)', borderRadius: '24px', padding: '40px 64px', textAlign: 'center', border: '2px solid rgba(255,255,255,0.15)' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--neutral-300)', textTransform: 'uppercase', marginBottom: '12px' }}>Rest Period</div>
            <div style={{ fontSize: '96px', fontWeight: 900, fontFamily: 'var(--font-mono)', color: restTimer <= 10 ? 'var(--aka)' : '#f59e0b', lineHeight: 1 }}>{formatRestTime(restTimer)}</div>
            <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--neutral-400)' }}>Next match begins soon</div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />

      <button className="fullscreen-btn" onClick={toggleFullscreen} title="Toggle Fullscreen (F)">
        <Maximize2 size={16} />
      </button>

      <div style={{ flex: 1, position: 'relative' }}>
        <ScaleWrapper>
          <KumiteLiveScoreboard
            akaName={aka.name}
            aoName={ao.name}
            akaAcademy={aka.academy}
            aoAcademy={ao.academy}
            akaCountry={aka.country}
            aoCountry={ao.country}
            akaScore={aka.score}
            aoScore={ao.score}
            akaIppon={aka.ippon}
            aoIppon={ao.ippon}
            akaWazaari={aka.wazaari}
            aoWazaari={ao.wazaari}
            akaYuko={aka.yuko}
            aoYuko={ao.yuko}
            akaC1={(aka.c1?1:0) + (aka.c2?1:0) + (aka.c3?1:0) + (aka.hc?1:0) + (aka.h?1:0)}
            aoC1={(ao.c1?1:0) + (ao.c2?1:0) + (ao.c3?1:0) + (ao.hc?1:0) + (ao.h?1:0)}
            akaC2={0}
            aoC2={0}
            akaSenshu={aka.senshu}
            aoSenshu={ao.senshu}
            timerDisplay={formatTime(timer)}
            timerColor={timer <= 15 ? 'var(--aka)' : 'var(--status-live)'}
            matchStatus={timer === 0 ? 'TIME OVER' : running ? 'MATCH LIVE' : timer === 180 ? 'PRE-MATCH' : 'PAUSED'}
            title="TAIKAIX"
            categoryName={rtdbData?.currentCategory || "KUMITE CATEGORY"}
            matchId={rtdbData?.displayId || `MAT ${new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('mat')?.replace('mat-', '').padStart(2, '0') || '01'}`}
            winnerName={winnerOverlay.active ? winnerOverlay.winner : undefined}
            winnerColor={winnerOverlay.classMode === 'winner-aka' ? 'aka' : winnerOverlay.classMode === 'winner-ao' ? 'ao' : undefined}
          />
        </ScaleWrapper>
        {winnerOverlay.active && (
          <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 300 }}>
            <button className="control-btn" onClick={() => setWinnerOverlay({ ...winnerOverlay, active: false })}>
              <X size={16} /> Close Winner Screen
            </button>
          </div>
        )}
      </div>

      {/* CONTROLS OVERLAY — hidden for kata (kata uses KataLiveScoreboard controls) */}
      <div className="controls-overlay">
        {!rtdbData?.isKata && (
          <>
            <div className="control-group">
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--aka)' }}>AKA</span>
              <button className="control-btn" onClick={() => addPoint('aka', 1)}>+1 <span className="key-hint">1</span></button>
              <button className="control-btn" onClick={() => addPoint('aka', 2)}>+2 <span className="key-hint">2</span></button>
              <button className="control-btn" onClick={() => addPoint('aka', 3)}>+3 <span className="key-hint">3</span></button>
              <button className="control-btn" onClick={() => addPenalty('aka', 'c1')} title="Add C1 Penalty (Shift+1)">C1</button>
              <button className="control-btn" onClick={() => addPenalty('aka', 'c2')} title="Add C2 Penalty (Shift+2)">C2</button>
            </div>
            
            <div className="control-group">
              <button className="control-btn" onClick={toggleTimer}>
                {running ? <><Pause size={16} /> <span>Pause</span></> : <><Play size={16} /> <span>Start</span></>}
                <span className="key-hint">Space</span>
              </button>
              <button className="control-btn" onClick={resetAll}>
                <RotateCcw size={16} /> <span>Reset</span> <span className="key-hint">R</span>
              </button>
            </div>

            <div className="control-group">
              <button className="control-btn" onClick={() => addPenalty('ao', 'c1')} title="Add C1 Penalty (Shift+Q)">C1</button>
              <button className="control-btn" onClick={() => addPenalty('ao', 'c2')} title="Add C2 Penalty (Shift+W)">C2</button>
              <button className="control-btn" onClick={() => addPoint('ao', 1)}>+1 <span className="key-hint">Q</span></button>
              <button className="control-btn" onClick={() => addPoint('ao', 2)}>+2 <span className="key-hint">W</span></button>
              <button className="control-btn" onClick={() => addPoint('ao', 3)}>+3 <span className="key-hint">E</span></button>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ao)' }}>AO</span>
            </div>
          </>
        )}

        {/* Rest Timer Controls — visible for both kumite and kata */}
        <div className="control-group" style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '16px' }}>
          <Coffee size={14} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>REST</span>
          {restRunning && restTimer > 0 ? (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#f59e0b', minWidth: '42px', textAlign: 'center' }}>{formatRestTime(restTimer)}</span>
              <button className="control-btn" onClick={() => { setRestRunning(false); setRestTimer(0); }} style={{ fontSize: '11px', padding: '4px 8px' }}>Stop</button>
            </>
          ) : (
            <>
              <button className="control-btn" onClick={() => startRest(30)} style={{ fontSize: '11px', padding: '4px 8px' }}>30s</button>
              <button className="control-btn" onClick={() => startRest(60)} style={{ fontSize: '11px', padding: '4px 8px' }}>60s</button>
              <button className="control-btn" onClick={() => startRest(90)} style={{ fontSize: '11px', padding: '4px 8px' }}>90s</button>
              <button className="control-btn" onClick={() => startRest(120)} style={{ fontSize: '11px', padding: '4px 8px' }}>2m</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
