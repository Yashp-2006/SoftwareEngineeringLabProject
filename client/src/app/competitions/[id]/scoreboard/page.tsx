'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Maximize2, Minimize2 } from 'lucide-react';
import KumiteLiveScoreboard from '@/modules/kumite/components/KumiteLiveScoreboard';
import KataLiveScoreboard, { deriveJudgeVotes } from '@/modules/kata/components/KataLiveScoreboard';
import ScaleWrapper from '@/modules/shared/components/ScaleWrapper';

function ScoreboardContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const matId = searchParams.get('mat') || 'mat-1';
  const autoFullscreen = searchParams.get('auto') === '1';

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Competition info
  const [compData, setCompData] = useState<any>(null);

  // Match state
  const [isKata, setIsKata] = useState(false);
  const [activeCategoryName, setActiveCategoryName] = useState('KUMITE');
  const [displayMatchId, setDisplayMatchId] = useState(`MAT ${matId.replace('mat-', '').padStart(2, '0')}`);
  const [matchStatus, setMatchStatus] = useState('PRE-MATCH');
  const [timerDisplay, setTimerDisplay] = useState('03:00');
  const [timerColor, setTimerColor] = useState('var(--status-live)');
  const [winnerState, setWinnerState] = useState<{ name?: string; color?: 'aka' | 'ao'; academy?: string; points?: number } | null>(null);
  const [nextMatch, setNextMatch] = useState<any>(null);

  // Kumite state
  const [aka, setAka] = useState({
    name: 'AKA',
    country: '',
    academy: '',
    score: 0,
    ippon: 0,
    waza: 0,
    yuko: 0,
    c1: 0,
    c2: 0,
    c3: 0,
    hc: 0,
    h: 0,
    senshu: false,
  });

  const [ao, setAo] = useState({
    name: 'AO',
    country: '',
    academy: '',
    score: 0,
    ippon: 0,
    waza: 0,
    yuko: 0,
    c1: 0,
    c2: 0,
    c3: 0,
    hc: 0,
    h: 0,
    senshu: false,
  });

  // Kata state
  const [selectedKata, setSelectedKata] = useState<any>(null);
  const [numberOfJudges, setNumberOfJudges] = useState<number>(3);
  const [judgeVotes, setJudgeVotes] = useState<Array<'aka' | 'ao' | 'tie' | null>>([null, null, null]);
  const [akaFlags, setAkaFlags] = useState<number>(0);
  const [aoFlags, setAoFlags] = useState<number>(0);
  const [revealVotes, setRevealVotes] = useState<boolean>(false);
  const [revealCountdown, setRevealCountdown] = useState<number>(0);
  const [kataWinner, setKataWinner] = useState<any>(null);

  // Track last broadcast timestamp to avoid stale RTDB overwrites
  const lastBroadcastTimestamp = useRef<number>(0);

  // Fetch competition name and logo
  useEffect(() => {
    let active = true;
    const fetchComp = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'competitions', id));
        if (snap.exists() && active) {
          setCompData(snap.data());
        }
      } catch (err) {
        console.error('Failed to load competition details', err);
      }
    };
    fetchComp();
    return () => { active = false; };
  }, [id]);

  // Apply state payload (shared between BroadcastChannel and RTDB)
  const applyStatePayload = useCallback((payload: any) => {
    if (!payload) return;

    if (payload.isKata !== undefined) setIsKata(Boolean(payload.isKata));
    if (payload.currentCategory) setActiveCategoryName(payload.currentCategory);
    if (payload.matchDisplayId || payload.matchId) {
      setDisplayMatchId(payload.matchDisplayId || payload.matchId);
    }

    if (payload.matchStatus) setMatchStatus(payload.matchStatus);
    if (payload.timeRemaining) {
      setTimerDisplay(payload.timeRemaining);
      const [m, s] = payload.timeRemaining.split(':').map(Number);
      const totalSec = (m || 0) * 60 + (s || 0);
      setTimerColor(totalSec <= 15 ? 'var(--aka)' : 'var(--status-live)');
    }

    // Winner state
    if (payload.winnerName || payload.winnerColor) {
      setWinnerState({
        name: payload.winnerName,
        color: payload.winnerColor,
        academy: payload.winnerAcademy,
        points: payload.winnerPoints
      });
    } else if (payload.winnerName === null && payload.winnerColor === null) {
      setWinnerState(null);
    }

    if (payload.nextMatch !== undefined) {
      setNextMatch(payload.nextMatch);
    }

    // Kumite fighters
    if (payload.aka) {
      setAka(prev => ({ ...prev, ...payload.aka }));
    } else if (payload.scores || payload.akaName) {
      setAka(prev => ({
        ...prev,
        name: payload.akaName ?? prev.name,
        country: payload.akaCountry ?? prev.country,
        academy: payload.akaAcademy ?? prev.academy,
        score: payload.scores?.aka ?? prev.score,
        yuko: payload.akaStats?.yuko ?? prev.yuko,
        waza: payload.akaStats?.waza ?? prev.waza,
        ippon: payload.akaStats?.ippon ?? prev.ippon,
        senshu: payload.akaStats?.senshu ?? prev.senshu,
        c1: payload.akaPenalties?.c1 ? 1 : (payload.akaC1 ?? prev.c1),
        c2: payload.akaPenalties?.c2 ? 1 : (payload.akaC2 ?? prev.c2),
        c3: payload.akaPenalties?.c3 ? 1 : (payload.akaC3 ?? prev.c3),
        hc: payload.akaPenalties?.hc ? 1 : (payload.akaHC ?? prev.hc),
        h: payload.akaPenalties?.h ? 1 : (payload.akaH ?? prev.h),
      }));
    }

    if (payload.ao) {
      setAo(prev => ({ ...prev, ...payload.ao }));
    } else if (payload.scores || payload.aoName) {
      setAo(prev => ({
        ...prev,
        name: payload.aoName ?? prev.name,
        country: payload.aoCountry ?? prev.country,
        academy: payload.aoAcademy ?? prev.academy,
        score: payload.scores?.ao ?? prev.score,
        yuko: payload.aoStats?.yuko ?? prev.yuko,
        waza: payload.aoStats?.waza ?? prev.waza,
        ippon: payload.aoStats?.ippon ?? prev.ippon,
        senshu: payload.aoStats?.senshu ?? prev.senshu,
        c1: payload.aoPenalties?.c1 ? 1 : (payload.aoC1 ?? prev.c1),
        c2: payload.aoPenalties?.c2 ? 1 : (payload.aoC2 ?? prev.c2),
        c3: payload.aoPenalties?.c3 ? 1 : (payload.aoC3 ?? prev.c3),
        hc: payload.aoPenalties?.hc ? 1 : (payload.aoHC ?? prev.hc),
        h: payload.aoPenalties?.h ? 1 : (payload.aoH ?? prev.h),
      }));
    }

    // Kata details
    if (payload.selectedKata !== undefined) setSelectedKata(payload.selectedKata);
    if (payload.akaKataName && !payload.selectedKata?.aka?.name) {
      setSelectedKata((prev: any) => ({ ...prev, aka: { ...(prev?.aka || {}), name: payload.akaKataName } }));
    }
    if (payload.aoKataName && !payload.selectedKata?.ao?.name) {
      setSelectedKata((prev: any) => ({ ...prev, ao: { ...(prev?.ao || {}), name: payload.aoKataName } }));
    }
    if (payload.numberOfJudges) setNumberOfJudges(payload.numberOfJudges);
    if (payload.judgeVotes) setJudgeVotes(payload.judgeVotes);
    if (payload.akaFlags !== undefined) setAkaFlags(payload.akaFlags);
    if (payload.aoFlags !== undefined) setAoFlags(payload.aoFlags);
    if (payload.revealVotes !== undefined) setRevealVotes(payload.revealVotes);
    if (payload.revealCountdown !== undefined) setRevealCountdown(payload.revealCountdown);
    if (payload.kataWinner !== undefined) setKataWinner(payload.kataWinner);

    // If raw kataScores present, derive votes
    if (payload.kataScores && !payload.judgeVotes) {
      const nJ = payload.numberOfJudges || 3;
      const derived = deriveJudgeVotes(payload.kataScores, nJ);
      setJudgeVotes(derived.judgeVotes);
      setAkaFlags(payload.kataVotes?.aka ?? derived.akaFlags);
      setAoFlags(payload.kataVotes?.ao ?? derived.aoFlags);
    }
  }, []);

  // 1. Native BroadcastChannel (0 ms Local Cross-Tab Sync)
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      const channelName = `taikaix_scoreboard_${id}_${matId}`;
      bc = new BroadcastChannel(channelName);

      bc.onmessage = (event) => {
        if (!event.data) return;
        if (event.data.type === 'STATE_UPDATE') {
          lastBroadcastTimestamp.current = Date.now();
          applyStatePayload(event.data.payload);
        }
      };

      // Announce to operator tab that scoreboard is open
      bc.postMessage({ type: 'SCOREBOARD_MOUNTED' });
    } catch (err) {
      console.warn('BroadcastChannel not supported or error:', err);
    }

    return () => {
      if (bc) bc.close();
    };
  }, [id, matId, applyStatePayload]);

  // 2. Firebase RTDB Listener (Cloud / Cross-Device Fallback)
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    const setupRTDB = async () => {
      try {
        const { rtdb } = await import('@lib/firebase');
        const { ref, onValue, off } = await import('firebase/database');
        const liveRef = ref(rtdb, `live_scores/${id}/mats/${matId}`);

        onValue(liveRef, (snapshot) => {
          // If we received a direct local broadcast in the last 600ms, ignore RTDB echo
          if (Date.now() - lastBroadcastTimestamp.current < 600) return;

          const val = snapshot.val();
          if (val) {
            applyStatePayload({
              ...val,
              matchDisplayId: val.currentMatch || `MAT ${matId.replace('mat-', '').padStart(2, '0')}`,
              matchStatus: val.status === 'finished' ? 'COMPLETED' : (val.timerRunning ? 'LIVE' : (val.status?.toUpperCase() || 'STANDBY')),
              timeRemaining: val.timeRemaining || '00:00',
              winnerName: val.winnerName,
              winnerColor: val.winnerColor,
            });
          }
        });

        unsubscribe = () => off(liveRef);
      } catch (err) {
        console.error('RTDB connection error:', err);
      }
    };

    setupRTDB();
    return () => unsubscribe();
  }, [id, matId, applyStatePayload]);

  // Fullscreen management
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      const el = containerRef.current || document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {
          document.documentElement.requestFullscreen().catch(() => {});
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    const handleFS = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFS);
    return () => document.removeEventListener('fullscreenchange', handleFS);
  }, []);

  // Keyboard controls: F for Fullscreen, Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen]);

  // Auto-fullscreen when opened with ?auto=1
  useEffect(() => {
    if (autoFullscreen) {
      const timer = setTimeout(() => {
        const el = containerRef.current || document.documentElement;
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoFullscreen]);

  // Mouse move handler to show/hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onDoubleClick={toggleFullscreen}
      style={{
        backgroundColor: '#000000',
        color: '#ffffff',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        cursor: showControls ? 'default' : 'none',
      }}
    >
      {/* Main Scoreboard Scale Container */}
      <ScaleWrapper>
        {isKata ? (
          <KataLiveScoreboard
            akaName={aka.name}
            aoName={ao.name}
            akaAcademy={aka.academy}
            aoAcademy={ao.academy}
            akaCountry={aka.country}
            aoCountry={ao.country}
            akaKataName={selectedKata?.aka?.name}
            aoKataName={selectedKata?.ao?.name}
            numberOfJudges={numberOfJudges}
            judgeVotes={judgeVotes}
            akaFlags={akaFlags}
            aoFlags={aoFlags}
            revealVotes={revealVotes}
            revealCountdown={revealCountdown}
            timeRemaining={timerDisplay}
            matchStatus={matchStatus}
            logoUrl={compData?.scoreboardLogo || compData?.logoUrl}
            title={`Mat ${matId.replace('mat-', '').padStart(2, '0')}: Kata Scoreboard`}
            subtitle={`${compData?.name || 'Tournament'} • ${activeCategoryName}`}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            kataWinner={winnerState ? winnerState.color : (kataWinner as any)}
            winnerName={winnerState?.name}
            winnerAcademy={winnerState?.academy}
            nextMatch={nextMatch}
            onDismissWinner={() => setWinnerState(null)}
          />
        ) : (
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
            akaWazaari={aka.waza}
            aoWazaari={ao.waza}
            akaYuko={aka.yuko}
            aoYuko={ao.yuko}
            akaC1={aka.c1}
            aoC1={ao.c1}
            akaC2={aka.c2}
            aoC2={ao.c2}
            akaC3={aka.c3}
            aoC3={ao.c3}
            akaHC={aka.hc}
            aoHC={ao.hc}
            akaH={aka.h}
            aoH={ao.h}
            akaPenalties={{ c1: aka.c1, c2: aka.c2, c3: aka.c3, hc: aka.hc, h: aka.h }}
            aoPenalties={{ c1: ao.c1, c2: ao.c2, c3: ao.c3, hc: ao.hc, h: ao.h }}
            akaSenshu={aka.senshu}
            aoSenshu={ao.senshu}
            timerDisplay={timerDisplay}
            timerColor={timerColor}
            matchStatus={matchStatus}
            title={compData?.name || 'KHEL KARATE'}
            categoryName={activeCategoryName}
            matchId={displayMatchId}
            winnerName={winnerState ? winnerState.name : undefined}
            winnerColor={winnerState ? winnerState.color : undefined}
            winnerAcademy={winnerState?.academy}
            nextMatch={nextMatch}
            onDismissWinner={() => setWinnerState(null)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            logoUrl={compData?.scoreboardLogo || compData?.logoUrl}
          />
        )}
      </ScaleWrapper>
    </div>
  );
}

export default function StandaloneScoreboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return (
    <Suspense fallback={<div style={{ background: '#000', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Connecting to Mat Scoreboard...</div>}>
      <ScoreboardContent id={id} />
    </Suspense>
  );
}
