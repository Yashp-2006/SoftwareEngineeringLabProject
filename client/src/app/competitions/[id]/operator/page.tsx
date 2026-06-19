'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Maximize, ArrowLeft, Play, Pause, Flag, RotateCw } from 'lucide-react';
import Header from '@/components/layout/Header';
import PasswordGateway from '@/components/auth/PasswordGateway';
import { toast } from 'react-hot-toast';
import KataOperatorPanel from '@/components/kata/KataOperatorPanel';
import KataLiveScoreboard, { deriveJudgeVotes } from '@/components/kata/KataLiveScoreboard';
import { useAuth } from '@/components/auth/AuthProvider';

export default function OperatorPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { role } = useAuth();
  const isViewer = role === 'audience' || role === 'guest_viewer' || !role;

  useEffect(() => {
    const handleFS = () => {
      if (document.fullscreenElement && document.fullscreenElement !== document.documentElement) {
        return;
      }
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFS);
    return () => document.removeEventListener('fullscreenchange', handleFS);
  }, []);
  
  // State
  const [aka, setAka] = useState({ name: 'AKA', country: '', academy: '', score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: '' });
  const [ao, setAo] = useState({ name: 'AO', country: '', academy: '', score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: '' });
  const [timer, setTimer] = useState(180);
  const [matchDuration, setMatchDuration] = useState(180); // configurable
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<'upcoming' | 'ongoing' | 'paused' | 'finished'>('ongoing');
  const [round, setRound] = useState(1);
  const [kataVotes, setKataVotes] = useState<{ aka: number, ao: number } | null>(null);
  const [kataWinner, setKataWinner] = useState<string | null>(null);

  const [queue, setQueue] = useState<any[]>([]);
  const [allCompletedMatches, setAllCompletedMatches] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [skippedCategories, setSkippedCategories] = useState<any[]>([]);
  const [poolStatuses, setPoolStatuses] = useState<Record<string, boolean>>({});
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const activeCategoryRef = useRef<string | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState('');
  const [activeCategoryData, setActiveCategoryData] = useState<any>(null);
  const [compData, setCompData] = useState<any>(null);
  const [matCategories, setMatCategories] = useState<any[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [tempQueue, setTempQueue] = useState<any[]>([]);
  
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [queueFilterPool, setQueueFilterPool] = useState('1');
  
  const filteredQueue = queue.filter(match => {
    let matchFullName = `${match.aka} ${match.ao}`.toLowerCase();
    let matchesSearch = queueSearchQuery ? matchFullName.includes(queueSearchQuery.toLowerCase()) : true;
    let matchesCat = activeCategoryName ? match.category === activeCategoryName : true;
    let matchesPool = queueFilterPool ? String(match.pool) === queueFilterPool : true;
    return matchesSearch && matchesCat && matchesPool;
  });
  const visibleQueue = filteredQueue;
  
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // No leaderboard needed — replaced by Skipped Categories panel

  // Cache firebase refs so we don't re-import on every tick
  const rtdbRefCache = useRef<any>(null);
  const rtdbSetCache = useRef<any>(null);
  const rtdbDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // RTDB sync — debounced to max 1 write per 500ms to avoid write storms during timer ticks
  const syncRTDB = useCallback(async (payload: any) => {
    if (isViewer) return;
    try {
      if (!rtdbRefCache.current || !rtdbSetCache.current) {
        const { rtdb } = await import('@lib/firebase');
        const { ref, update } = await import('firebase/database');
        const matId = new URLSearchParams(window.location.search).get('mat') || 'mat-1';
        rtdbRefCache.current = ref(rtdb, `live_scores/${id}/mats/${matId}`);
        rtdbSetCache.current = update;
      }
      await rtdbSetCache.current(rtdbRefCache.current, payload);
    } catch (err) {
      console.error('Failed to sync RTDB', err);
    }
  }, [id]);

  useEffect(() => {
    const mm = Math.floor(timer / 60).toString().padStart(2, '0');
    const ss = (timer % 60).toString().padStart(2, '0');
    const payload = {
      status: status === 'finished' ? 'standby' : (status === 'upcoming' ? 'upcoming' : (running ? 'live' : 'paused')),
      currentCategory: activeCategoryName || 'No Active Category',
      isKata: activeCategoryName?.toLowerCase().includes('kata') || false,
      numberOfJudges: activeCategoryData?.numberOfJudges || 3,
      currentMatch: queue[0]?.displayId || 'Standby',
      akaName: aka.name, akaCountry: aka.country, akaAcademy: aka.academy,
      aoName: ao.name, aoCountry: ao.country, aoAcademy: ao.academy,
      scores: { aka: aka.score, ao: ao.score },
      akaStats: { yuko: aka.yuko, waza: aka.waza, ippon: aka.ippon, senshu: aka.senshu },
      aoStats: { yuko: ao.yuko, waza: ao.waza, ippon: ao.ippon, senshu: ao.senshu },
      akaPenalties: { c1: aka.c1, c2: aka.c2, c3: aka.c3, hc: aka.hc, h: aka.h },
      aoPenalties:  { c1: ao.c1,  c2: ao.c2,  c3: ao.c3,  hc: ao.hc,  h: ao.h  },
      timerSeconds: timer, timerRunning: running, timeRemaining: `${mm}:${ss}`,
    };

    // Immediate sync for non-timer events (score/status/penalty changes)
    // Debounced to 500ms for timer ticks to avoid 1 write/sec write storms
    if (!isViewer) {
      if (rtdbDebounceTimer.current) clearTimeout(rtdbDebounceTimer.current);
      rtdbDebounceTimer.current = setTimeout(() => syncRTDB(payload), 500);
    }

    return () => {
      if (rtdbDebounceTimer.current) clearTimeout(rtdbDebounceTimer.current);
    };
  }, [id, aka, ao, timer, status, running, activeCategoryName, queue, syncRTDB, isViewer]);

  // Viewer RTDB listener
  useEffect(() => {
    if (!isViewer) return;
    let unsubscribe = () => {};
    const setupListener = async () => {
      const { rtdb } = await import('@lib/firebase');
      const { ref, onValue, off } = await import('firebase/database');
      const matId = new URLSearchParams(window.location.search).get('mat') || 'mat-1';
      const liveRef = ref(rtdb, `live_scores/${id}/mats/${matId}`);
      
      onValue(liveRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          setAka(prev => ({ ...prev, name: val.akaName || prev.name, country: val.akaCountry || prev.country, academy: val.akaAcademy || prev.academy, score: val.scores?.aka || 0, yuko: val.akaStats?.yuko || 0, waza: val.akaStats?.waza || 0, ippon: val.akaStats?.ippon || 0, senshu: val.akaStats?.senshu || false, c1: val.akaPenalties?.c1 || 0, c2: val.akaPenalties?.c2 || 0, c3: val.akaPenalties?.c3 || 0, hc: val.akaPenalties?.hc || 0, h: val.akaPenalties?.h || 0 }));
          setAo(prev => ({ ...prev, name: val.aoName || prev.name, country: val.aoCountry || prev.country, academy: val.aoAcademy || prev.academy, score: val.scores?.ao || 0, yuko: val.aoStats?.yuko || 0, waza: val.aoStats?.waza || 0, ippon: val.aoStats?.ippon || 0, senshu: val.aoStats?.senshu || false, c1: val.aoPenalties?.c1 || 0, c2: val.aoPenalties?.c2 || 0, c3: val.aoPenalties?.c3 || 0, hc: val.aoPenalties?.hc || 0, h: val.aoPenalties?.h || 0 }));
          setStatus(val.status || 'ongoing');
          if (val.currentCategory) setActiveCategoryName(val.currentCategory);
          setKataVotes(val.kataVotes || null);
          setKataWinner(val.kataWinner || null);
          if (val.timeRemaining) {
            const [mm, ss] = val.timeRemaining.split(':').map(Number);
            if (!isNaN(mm) && !isNaN(ss)) setTimer(mm * 60 + ss);
          }
          setRunning(val.timerRunning || false);
        }
      });
      unsubscribe = () => off(liveRef);
    };
    setupListener();
    return () => unsubscribe();
  }, [id, isViewer]);


  useEffect(() => {
    let unsubscribe = () => {};
    const setupQueue = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, query, where, doc, getDoc } = await import('firebase/firestore');

      const params = new URLSearchParams(window.location.search);
      const matId = params.get('mat') || 'mat-1';
      const matNumberStr = matId.replace('mat-', '');
      const matName = `MAT ${matNumberStr.padStart(2, '0')}`;
      
      const compRef = doc(db, 'competitions', id);
      const compSnap = await getDoc(compRef);
      if (compSnap.exists()) {
        setCompData(compSnap.data());
      }

      const qMat = query(
        collection(db, 'competitions', id, 'categories'),
        where('mat', '==', matName)
      );

      unsubscribe = onSnapshot(qMat, (snap) => {
        let cats = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        
        let completed: any[] = [];
        cats.forEach(cat => {
          (cat.matches || []).forEach((m: any) => {
            if (m.status === 'completed' && m.winnerId) {
              completed.push(m);
            }
          });
        });
        setAllCompletedMatches(completed);

        // Extract skipped categories for the sidebar
        const skipped = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((c: any) => c.status === 'skipped');
        setSkippedCategories(skipped);
        setMatCategories(cats);

        cats = cats.filter(c => c.status === 'live' || c.status === 'upcoming');
        cats.sort((a, b) => (a.order || 0) - (b.order || 0));

        if (cats.length > 0) {
          const activeCat = cats[0];
          if (activeCategoryRef.current !== null && activeCategoryRef.current !== activeCat.id) {
            setActiveMatchId(null);
          }
          activeCategoryRef.current = activeCat.id;
          setActiveCategoryId(activeCat.id);
          setActiveCategoryName(activeCat.name);
          setActiveCategoryData(activeCat);
          const matches = activeCat.matches || [];
          
          const pendingMatches = matches.filter((m: any) => m.status !== 'completed');
          const completedMatches = matches.filter((m: any) => m.status === 'completed').reverse().slice(0, 3);
          setRecentMatches(completedMatches);
          
          const mappedQueue = pendingMatches.map((m: any) => ({
            id: m.id,
            displayId: m.matchNumber ? `M${String(m.matchNumber).padStart(2, '0')}` : m.id,
            aka: m.aka?.name || (m.akaFromMatchId ? `Winner M${m.akaFromMatchId}` : 'Empty'),
            akaId: m.aka?.playerId || m.aka?.name,
            akaAcademy: m.aka?.academy || '',
            akaCountry: m.aka?.country || m.aka?.state || '',
            ao: m.ao?.name || (m.aoFromMatchId ? `Winner M${m.aoFromMatchId}` : 'Empty'),
            aoId: m.ao?.playerId || m.ao?.name,
            aoAcademy: m.ao?.academy || '',
            aoCountry: m.ao?.country || m.ao?.state || '',
            category: activeCat.name,
            pool: m.pool || (m.id && m.id.includes('Pool') ? m.id.split('-')[0].replace('Pool', '') : null),
            akaReady: m.aka?.readiness === 'ready',
            aoReady: m.ao?.readiness === 'ready',
          })).filter((m: any) => !m.aka.startsWith('Winner M') && !m.ao.startsWith('Winner M'));
          setQueue(mappedQueue);
          
          const poolStats: Record<string, { total: number, completed: number }> = {};
          matches.forEach((m: any) => {
            const p = m.pool || (m.id && m.id.includes('Pool') ? m.id.split('-')[0].replace('Pool', '') : null);
            if (!p) return;
            
            // Check if it's a real match (has at least one player or comes from another match)
            const isRealMatch = !!(m.aka?.playerId || m.aka?.name || m.akaFromMatchId || m.ao?.playerId || m.ao?.name || m.aoFromMatchId);
            if (!isRealMatch) return;

            if (!poolStats[p]) poolStats[p] = { total: 0, completed: 0 };
            poolStats[p].total++;
            if (m.status === 'completed') poolStats[p].completed++;
          });
          const pStatuses: Record<string, boolean> = {};
          Object.keys(poolStats).forEach(p => {
            pStatuses[p] = poolStats[p].total > 0 && poolStats[p].total === poolStats[p].completed;
          });
          setPoolStatuses(pStatuses);
          
        } else {
          setQueue([]);
          setRecentMatches([]);
          setPoolStatuses({});
          activeCategoryRef.current = null;
          setActiveCategoryId(null);
          setActiveCategoryName('');
          setActiveCategoryData(null);
        }
      });
    };
    setupQueue();
    return () => unsubscribe();
  }, [id]);
  const loadMatch = (m: any, isHydrating = false) => {
    setActiveMatchId(m.id);
    setAka({ name: m.aka, country: m.akaCountry, academy: m.akaAcademy, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: m.akaId });
    setAo({ name: m.ao, country: m.aoCountry, academy: m.aoAcademy, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: m.aoId });
    setTimer(matchDuration);
    setStatus('upcoming');
    setRound(1);
    setWinnerState(null);

    const isKata = activeCategoryData?.isKata || activeCategoryName?.toLowerCase().includes('kata');

    if (!isViewer && !isHydrating) {
      try {
        syncRTDB({
          matchId: m.id,
          categoryId: activeCategoryId,
          displayId: m.displayId || m.id,
          aka: m.aka || 'Empty',
          ao: m.ao || 'Empty',
          akaScore: 0,
          aoScore: 0,
          akaPenalties: 0,
          aoPenalties: 0,
          timer: matchDuration,
          running: false,
          status: 'upcoming',
          round: 1,
          isKata: !!isKata,
          boutFinished: false,
          winnerState: null,
          kataScores: null,
          kataVotes: null,
          kataWinner: null,
          selectedKata: null,
          phase: 'kata'
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    const matIdParam = new URLSearchParams(window.location.search).get('mat') || 'mat-1';

    if (queue.length > 0 && !activeMatchId) {
      const storedMatchId = sessionStorage.getItem(`activeMatch_${matIdParam}`);
      const exists = queue.find(m => m.id === storedMatchId);
      
      if (exists) {
        loadMatch(exists, true);
        // Hydrate operator local state from RTDB
        if (!isViewer) {
          import('firebase/database').then(({ ref, get }) => {
            import('@lib/firebase').then(({ rtdb }) => {
              get(ref(rtdb, `live_scores/${id}/mats/${matIdParam}`)).then((snap) => {
                 if (snap.exists()) {
                    const d = snap.val();
                    if (d.matchId === exists.id) {
                       setAka(prev => ({ ...prev, score: d.scores?.aka || 0, yuko: d.akaStats?.yuko || 0, waza: d.akaStats?.waza || 0, ippon: d.akaStats?.ippon || 0, senshu: d.akaStats?.senshu || false, c1: d.akaPenalties?.c1 || false, c2: d.akaPenalties?.c2 || false, c3: d.akaPenalties?.c3 || false, hc: d.akaPenalties?.hc || false, h: d.akaPenalties?.h || false }));
                       setAo(prev => ({ ...prev, score: d.scores?.ao || 0, yuko: d.aoStats?.yuko || 0, waza: d.aoStats?.waza || 0, ippon: d.aoStats?.ippon || 0, senshu: d.aoStats?.senshu || false, c1: d.aoPenalties?.c1 || false, c2: d.aoPenalties?.c2 || false, c3: d.aoPenalties?.c3 || false, hc: d.aoPenalties?.hc || false, h: d.aoPenalties?.h || false }));
                       if (d.timerSeconds !== undefined) setTimer(d.timerSeconds);
                       if (d.timerRunning !== undefined) setRunning(d.timerRunning);
                       if (d.status) {
                          setStatus(d.status === 'live' || d.status === 'paused' ? 'upcoming' : d.status);
                       }
                    }
                 }
              });
            });
          });
        }
      } else {
        loadMatch(queue[0]);
      }
    } else if (queue.length > 0 && activeMatchId) {
       sessionStorage.setItem(`activeMatch_${matIdParam}`, activeMatchId);
       // Keep names in sync if edited externally
       const m = queue.find(q => q.id === activeMatchId);
       if (m) {
         setAka(p => ({ ...p, name: m.aka, country: m.akaCountry, academy: m.akaAcademy }));
         setAo(p => ({ ...p, name: m.ao, country: m.aoCountry, academy: m.aoAcademy }));
       }
    }
  }, [queue, activeMatchId, id, isViewer]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropQueue = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    
    // In a real app we'd save this order to Firestore
    const newQueue = [...queue];
    const [draggedItem] = newQueue.splice(draggedIdx, 1);
    newQueue.splice(targetIdx, 0, draggedItem);
    
    setQueue(newQueue);
    setDraggedIdx(null);
  };

  const handleDropModal = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    
    const newQueue = [...tempQueue];
    const [draggedItem] = newQueue.splice(draggedIdx, 1);
    newQueue.splice(targetIdx, 0, draggedItem);
    
    setTempQueue(newQueue);
    setDraggedIdx(null);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (running && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && running) {
      setRunning(false);
    }
    return () => clearInterval(interval);
  }, [running, timer]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  });

  const addPoint = (side: 'aka' | 'ao', points: number) => {
    if (status === 'finished') return;
    const setSide = side === 'aka' ? setAka : setAo;
    setSide(prev => {
      const next = { ...prev };
      if (points === 3) next.ippon++;
      if (points === 2) next.waza++;
      if (points === 1) next.yuko++;
      if (points === -3) next.ippon = Math.max(0, next.ippon - 1);
      if (points === -2) next.waza = Math.max(0, next.waza - 1);
      if (points === -1) next.yuko = Math.max(0, next.yuko - 1);
      
      next.score = Math.max(0, next.score + points);
      return next;
    });
  };

  const togglePenalty = (side: 'aka' | 'ao', type: 'c1' | 'c2' | 'c3' | 'hc' | 'h') => {
    if (status === 'finished') return;
    const setSide = side === 'aka' ? setAka : setAo;
    setSide(prev => ({ ...prev, [type]: prev[type] ? 0 : 1 }));
  };

  const toggleSenshu = (side: 'aka' | 'ao') => {
    if (side === 'aka') {
      setAka(p => ({ ...p, senshu: !p.senshu }));
      if (!aka.senshu) setAo(p => ({ ...p, senshu: false }));
    } else {
      setAo(p => ({ ...p, senshu: !p.senshu }));
      if (!ao.senshu) setAka(p => ({ ...p, senshu: false }));
    }
  };

  const mins = Math.floor(timer / 60).toString().padStart(2, '0');
  const secs = (timer % 60).toString().padStart(2, '0');

  const [winnerState, setWinnerState] = useState<{ color: 'aka'|'ao', name: string, academy: string, points: number } | null>(null);

  const handleNextMatch = () => {
    const currentIdx = queue.findIndex(m => m.id === activeMatchId);
    if (currentIdx !== -1 && queue.length > currentIdx + 1) {
      loadMatch(queue[currentIdx + 1]);
    } else if (currentIdx === -1 && queue.length > 0) {
      loadMatch(queue[0]);
    } else {
      toast.error("No pending matches in queue");
    }
  };

  const handleStartCategory = async () => {
    if (!activeCategoryId) return;
    try {
      const { db } = await import('@lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      const catRef = doc(db, 'competitions', id, 'categories', activeCategoryId);
      await updateDoc(catRef, { status: 'live' });
      toast.success('Category started!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to start category.');
    }
  };

  const handleNextCategory = async () => {
    if (!activeCategoryId) return;
    try {
      const { db } = await import('@lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      const catRef = doc(db, 'competitions', id, 'categories', activeCategoryId);
      await updateDoc(catRef, { status: 'skipped' });
      toast.success('Skipped to next category');
    } catch (err) {
      console.error(err);
      toast.error('Failed to skip category.');
    }
  };

  const handleFinishMatch = async () => {
    const currentMatch = queue.find(m => m.id === activeMatchId);
    if (!currentMatch || !activeCategoryId) {
      toast.error('No active match to finish');
      return;
    }
    setRunning(false);
    setStatus('finished');
    
    let winnerId = null;
    let winningColor: 'aka' | 'ao' | null = null;
    if (aka.score > ao.score) {
      winnerId = activeMatchId; // Wait, we need the actual competitor ID if possible. But we have aka.name
      winningColor = 'aka';
    } else if (ao.score > aka.score) {
      winnerId = activeMatchId; // Just for API patching
      winningColor = 'ao';
    } else if (aka.senshu) {
      winnerId = activeMatchId;
      winningColor = 'aka';
    } else if (ao.senshu) {
      winnerId = activeMatchId;
      winningColor = 'ao';
    }
    
    if (!winningColor) {
      toast.error('Tie! Please assign Senshu or resolve before finishing.');
      return;
    }

    try {
      // Find the match in queue to get the real winnerId
      const currentMatch = queue.find(m => m.id === activeMatchId);
      const realWinnerId = winningColor === 'aka' ? currentMatch?.akaId : currentMatch?.aoId;

      setWinnerState({
        color: winningColor,
        name: winningColor === 'aka' ? aka.name : ao.name,
        academy: winningColor === 'aka' ? aka.academy : ao.academy,
        points: winningColor === 'aka' ? aka.score : ao.score
      });

      // Optimistic UI update for instant feedback
      if (currentMatch) {
        setRecentMatches(prev => [{
          ...currentMatch,
          status: 'completed',
          winnerId: realWinnerId || winnerId,
          akaScore: aka.score,
          aoScore: ao.score,
        }, ...prev].slice(0, 3));
        setQueue(prev => prev.filter(m => m.id !== activeMatchId));
      }

      const res = await fetch(`/api/competitions/${id}/brackets/${activeCategoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: activeMatchId, winnerId: realWinnerId || winnerId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Match finished and winner advanced!');
      } else {
        toast.error('Failed to advance winner: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to finish match.');
    }
  };

  const handleDisqualify = async (side: 'aka' | 'ao') => {
    const currentMatch = queue.find(m => m.id === activeMatchId);
    if (!currentMatch || !activeCategoryId) {
      toast.error('No active match to disqualify from');
      return;
    }
    setRunning(false);
    setStatus('finished');

    const winnerSide = side === 'aka' ? 'ao' : 'aka';
    const winnerId = winnerSide === 'aka' ? currentMatch?.akaId : currentMatch?.aoId;
    const loserName = side === 'aka' ? aka.name : ao.name;
    const winnerName = side === 'aka' ? ao.name : aka.name;

    setWinnerState({
      color: winnerSide,
      name: winnerName,
      academy: winnerSide === 'aka' ? aka.academy : ao.academy,
      points: winnerSide === 'aka' ? aka.score : ao.score
    });

    if (currentMatch) {
      setRecentMatches(prev => [{
        ...currentMatch,
        status: 'completed',
        winnerId: winnerId,
        akaScore: aka.score,
        aoScore: ao.score,
      }, ...prev].slice(0, 3));
      setQueue(prev => prev.filter(m => m.id !== activeMatchId));
    }

    try {
      const res = await fetch(`/api/competitions/${id}/brackets/${activeCategoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: activeMatchId, winnerId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${loserName} disqualified. ${winnerName} advances!`);
      } else {
        toast.error('Failed to advance winner: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to process disqualification.');
    }
  };

  const handleRestoreSkipped = async (catId: string, catName: string) => {
    try {
      const { db } = await import('@lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'competitions', id, 'categories', catId), { status: 'upcoming' });
      toast.success(`${catName} restored to queue`);
    } catch (err) {
      toast.error('Failed to restore category');
    }
  };

  const handleFinishCategory = async () => {
    try {
      const { db } = await import('@lib/firebase');
      const { collection, getDocs, query, where, updateDoc, doc } = await import('firebase/firestore');
      
      const params = new URLSearchParams(window.location.search);
      const matId = params.get('mat') || 'mat-1';
      const matNumberStr = matId.replace('mat-', '');
      const matName = `MAT ${matNumberStr.padStart(2, '0')}`;
      
      const q = query(
        collection(db, 'competitions', id, 'categories'),
        where('mat', '==', matName),
        where('status', 'in', ['live', 'upcoming'])
      );
      
      const snaps = await getDocs(q);
      if (snaps.empty) {
        toast.error(`No active categories found on ${matName} to finish.`);
        return;
      }
      
      const targetDoc = snaps.docs[0];
      const catRef = doc(db, 'competitions', id, 'categories', targetDoc.id);
      
      const addMinutesToTime = (timeStr: string, minutes: number) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        let totalM = h * 60 + m + minutes;
        if (totalM < 0) totalM = 0;
        const newH = Math.floor(totalM / 60) % 24;
        const newM = totalM % 60;
        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
      };

      const getTimeDiffMins = (startStr: string, endStr: string) => {
        if (!startStr || !endStr) return 0;
        const [sh, sm] = startStr.split(':').map(Number);
        const [eh, em] = endStr.split(':').map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
      };

      const now = new Date();
      const actualEndH = now.getHours();
      const actualEndM = now.getMinutes();
      const actualEndStr = `${String(actualEndH).padStart(2, '0')}:${String(actualEndM).padStart(2, '0')}`;
      
      const targetData = targetDoc.data();

      const matches = targetData.matches || [];
      const athletes = targetData.athletes || [];
      const finalMatch = matches.find((m: any) => !m.nextMatchId);

      let goldMedalistId = null;
      let silverMedalistId = null;
      const bronzeMedalistsIds: string[] = [];

      if (finalMatch && finalMatch.status === 'completed' && finalMatch.winnerId) {
        goldMedalistId = finalMatch.winnerId;
        silverMedalistId = finalMatch.winnerId === finalMatch.aka?.playerId ? finalMatch.ao?.playerId : finalMatch.aka?.playerId;

        if (compData?.bronzeRule === 'two' || !compData?.bronzeRule) {
          const semiFinals = matches.filter((m: any) => m.nextMatchId === finalMatch.id && m.status === 'completed');
          semiFinals.forEach((sf: any) => {
            if (sf.winnerId) {
              const loserId = sf.winnerId === sf.aka?.playerId ? sf.ao?.playerId : sf.aka?.playerId;
              if (loserId) bronzeMedalistsIds.push(loserId);
            }
          });
        }
      }

      const updatedAthletes = athletes.map((a: any) => {
        if (a.playerId === goldMedalistId) return { ...a, medal: 'gold' };
        if (a.playerId === silverMedalistId) return { ...a, medal: 'silver' };
        if (bronzeMedalistsIds.includes(a.playerId)) return { ...a, medal: 'bronze' };
        return a;
      });

      await updateDoc(catRef, { 
        status: 'done', 
        actualEndTime: actualEndStr,
        athletes: updatedAthletes
      });
      const diffMins = getTimeDiffMins(targetData.scheduledEndTime, actualEndStr);
      
      if (diffMins !== 0) {
        const { writeBatch } = await import('firebase/firestore');
        const upcomingQ = query(
          collection(db, 'competitions', id, 'categories'),
          where('mat', '==', matName),
          where('status', '==', 'upcoming')
        );
        const upcomingSnaps = await getDocs(upcomingQ);
        const batch = writeBatch(db);
        let shiftedCount = 0;
        
        upcomingSnaps.docs.forEach(d => {
          const data = d.data();
          const newStart = addMinutesToTime(data.scheduledStartTime, diffMins);
          const newEnd = addMinutesToTime(data.scheduledEndTime, diffMins);
          batch.update(d.ref, {
            scheduledStartTime: newStart,
            scheduledEndTime: newEnd
          });
          shiftedCount++;
        });
        
        if (shiftedCount > 0) {
          await batch.commit();
        }
      }
      
      toast.success(`Category ${targetData.name} marked as DONE! Check the Schedule page to see the preemptive shift.`);
    } catch (err) {
      console.error(err);
      toast.error("Error finishing category.");
    }
  };

  const prevCategoryRef = React.useRef(activeCategoryId);
  React.useEffect(() => {
    if (activeCategoryId !== prevCategoryRef.current) {
      setActiveMatchId(null);
      prevCategoryRef.current = activeCategoryId;
    }
  }, [activeCategoryId]);

  const isKataCategory = activeCategoryData?.isKata || activeCategoryName?.toLowerCase().includes('kata') || false;
  const kataJudgeCount = activeCategoryData?.numberOfJudges || 3;
  const kataScoresDerived = React.useMemo(() => deriveJudgeVotes(
    null, 
    kataJudgeCount
  ), [kataJudgeCount]);

  const matIdParam = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('mat') || 'mat-1') : 'mat-1';
  const matNum = matIdParam.replace('mat-', '').padStart(2, '0');

  return (
    <PasswordGateway>
      {/* FULLSCREEN OVERLAY */}
      {isFullscreen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fdfbfb', zIndex: 9999, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {isKataCategory ? (
            <KataLiveScoreboard
              akaName={aka.name}
              aoName={ao.name}
              akaAcademy={aka.academy}
              aoAcademy={ao.academy}
              akaCountry={aka.country}
              aoCountry={ao.country}
              numberOfJudges={kataJudgeCount}
              judgeVotes={kataVotes ? (() => {
                const votes: Array<'aka' | 'ao' | 'tie' | null> = Array(kataJudgeCount).fill(null);
                return votes;
              })() : Array(kataJudgeCount).fill(null)}
              akaFlags={kataVotes?.aka || 0}
              aoFlags={kataVotes?.ao || 0}
              round={round}
              timeRemaining={`${Math.floor(timer / 60).toString().padStart(2, '0')}:${(timer % 60).toString().padStart(2, '0')}`}
              matchStatus={status === 'finished' ? 'COMPLETED' : (running ? 'LIVE' : status.toUpperCase())}
              logoUrl={compData?.scoreboardLogo}
              title={`Mat ${matNum} — Kata Scoreboard`}
              subtitle={`${compData?.name || 'Tournament'} • ${activeCategoryName || 'Kata'}`}
              onToggleFullscreen={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                } else {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              isFullscreen={isFullscreen}
              onBack={() => {
                if (isViewer) {
                  window.location.href = `/competitions/${id}/mats`;
                } else {
                  if (document.fullscreenElement) document.exitFullscreen();
                  setIsFullscreen(false);
                }
              }}
              kataWinner={winnerState ? winnerState.color : (kataWinner as any)}
              winnerName={winnerState?.name}
            />
          ) : (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                .overlay-header { display: flex; justify-content: space-between; align-items: center; padding: 24px 40px; }
                .overlay-title { font-size: 32px; font-weight: 800; color: var(--neutral-900); }
                .overlay-title-live { color: var(--aka); }
                .overlay-meta { font-size: 14px; font-weight: 700; color: var(--neutral-500); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }
                .overlay-actions { display: flex; gap: 12px; }
                .overlay-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--neutral-300); background: var(--shiro); transition: all 0.2s; }
                .overlay-btn:hover { background: var(--neutral-50); border-color: var(--neutral-400); }
                .overlay-btn.return { background: var(--neutral-900); color: var(--shiro); border-color: var(--neutral-900); }
                .overlay-btn.return:hover { background: var(--neutral-800); }

                .fs-body { display: grid; grid-template-columns: 140px 1fr 200px 1fr 140px; gap: 24px; padding: 0 40px 40px; flex: 1; min-height: 0; }
                .fs-stat-col { width: 140px; display: flex; flex-direction: column; gap: 16px; flex-shrink: 0; }
                .fs-stat-card { flex: 1; background: var(--shiro); border: 1px solid var(--neutral-200); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
                .fs-stat-label { font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--neutral-900); letter-spacing: 0.05em; margin-bottom: 8px; }
                .fs-stat-value { font-family: var(--font-display); font-size: 32px; font-weight: 800; color: var(--ao); }
                .fs-stat-value.aka { color: var(--aka); }
                .fs-stat-card.active-senshu { background: var(--shiro); border-width: 2px; }
                .fs-stat-card.active-senshu.aka { border-color: var(--aka); background: var(--aka); color: var(--shiro); }
                .fs-stat-card.active-senshu.ao { border-color: var(--ao); background: var(--ao); color: var(--shiro); }

                .fs-fighter { background: var(--shiro); border: 1px solid var(--neutral-200); border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.04); }
                .fs-fighter-head { padding: 16px 24px; text-align: center; color: var(--shiro); flex-shrink: 0; }
                .fs-fighter-head.aka { background: var(--aka); }
                .fs-fighter-head.ao { background: var(--ao); }
                .fs-lane { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.9; margin-bottom: 4px; }
                .fs-name { font-size: clamp(32px, 4vw, 48px); font-weight: 800; line-height: 1; text-transform: uppercase; }
                
                .fs-score-stage { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
                .fs-main-score { font-family: var(--font-display); font-size: clamp(120px, 15vw, 240px); font-weight: 800; line-height: 1; }
                .fs-main-score.aka { color: var(--aka); }
                .fs-main-score.ao { color: var(--ao); }

                .fs-fighter-foot { padding: 16px 24px; border-top: 1px solid var(--neutral-200); text-align: center; flex-shrink: 0; }
                .fs-pen-title { font-size: 11px; font-weight: 800; color: var(--neutral-500); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
                .fs-penalties { display: flex; justify-content: center; gap: clamp(12px, 2vw, 24px); margin-bottom: 8px; }
                .fs-pen-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; }
                .fs-pen-code { font-size: 10px; font-weight: 700; color: var(--neutral-400); }
                .fs-pen-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--neutral-200); background: transparent; }
                .fs-pen-dot.aka.active { border-color: var(--aka); background: var(--aka); }
                .fs-pen-dot.ao.active { border-color: var(--ao); background: var(--ao); }
                .fs-academy { font-size: 14px; font-weight: 700; color: var(--neutral-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                .fs-winner-showcase { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; border-radius: 24px; padding: 48px; text-align: center; }
                .fs-winner-showcase.aka { background: var(--aka); color: #fff; }
                .fs-winner-showcase.ao { background: var(--ao); color: #fff; }
                .fs-winner-title { font-size: clamp(40px, 5vw, 60px); font-weight: 800; letter-spacing: 0.1em; margin-bottom: 24px; text-transform: uppercase; }
                .fs-winner-name { font-family: var(--font-display); font-size: clamp(60px, 8vw, 120px); font-weight: 800; line-height: 1; text-transform: uppercase; margin-bottom: 16px; color: #fff; }
                .fs-winner-points { font-family: var(--font-display); font-size: clamp(140px, 20vw, 320px); font-weight: 800; line-height: 1; margin-bottom: 24px; color: #fff; }
                @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-16px); } 100% { transform: translateY(0px); } }

                .fs-mid { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
                .fs-round-pill { border: 1px solid var(--neutral-300); background: var(--shiro); padding: 4px 16px; border-radius: 999px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .fs-timer-label { font-size: 12px; font-weight: 800; color: var(--neutral-900); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; margin-top: auto; }
                .fs-timer { background: var(--shiro); border: 1px solid var(--neutral-200); border-radius: 16px; width: 100%; padding: 16px 0; font-family: var(--font-mono); font-size: clamp(40px, 5vw, 64px); font-weight: 800; color: var(--neutral-900); margin-bottom: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.03); }
                .fs-status-wrap { width: 100%; background: var(--shiro); border: 1px solid var(--neutral-200); border-radius: 16px; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); margin-top: auto; }
                .fs-status-label { font-size: 11px; font-weight: 800; color: var(--neutral-500); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
                .fs-status-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; background: var(--neutral-100); color: var(--neutral-600); }
              `}} />

              <div className="overlay-header">
                <div>
                  <div className="overlay-title">Mat {matNum} — <span className="overlay-title-live">Live Scoreboard</span></div>
                  <div className="overlay-meta">{compData?.name || 'Tournament'} • {activeCategoryName || 'Waiting for category'} {activeMatchId && queue.find(m => m.id === activeMatchId)?.displayId ? `• ${queue.find(m => m.id === activeMatchId)?.displayId}` : ''}</div>
                </div>
                <div className="overlay-actions">
                  <button className="overlay-btn" onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen().catch(()=>{});
                    } else {
                      document.documentElement.requestFullscreen().catch(()=>{} );
                    }
                  }}>
                    <Maximize size={16} /> {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  </button>
                  {!isFullscreen && (
                    <button className="overlay-btn return" onClick={() => {
                      if (isViewer) {
                        window.location.href = `/competitions/${id}/mats`;
                      } else {
                        if (document.fullscreenElement) document.exitFullscreen();
                        setIsFullscreen(false);
                      }
                    }}>
                      <ArrowLeft size={16} /> {isViewer ? 'Return to Mat' : 'Return to Mat Operations'}
                    </button>
                  )}
                </div>
              </div>

              <div className="fs-body" style={{ display: winnerState ? 'flex' : 'grid', height: winnerState ? '100%' : 'auto' }}>
                {winnerState ? (
                  <div style={{ flex: 1, padding: '24px 0', display: 'flex', flexDirection: 'column' }}>
                    <div className={`fs-winner-showcase ${winnerState.color}`}>
                      <div className="fs-winner-title">{winnerState.color === 'aka' ? 'AKA WINS' : 'AO WINS'}</div>
                      <div className="fs-winner-points">{winnerState.points}</div>
                      <div className="fs-winner-name">{winnerState.name}</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="fs-stat-col">
                      <div className="fs-stat-card"><div className="fs-stat-label">Yuko</div><div className="fs-stat-value aka">{aka.yuko}</div></div>
                      <div className="fs-stat-card"><div className="fs-stat-label">Waza</div><div className="fs-stat-value aka">{aka.waza}</div></div>
                      <div className="fs-stat-card"><div className="fs-stat-label">Ippon</div><div className="fs-stat-value aka">{aka.ippon}</div></div>
                      <div className={`fs-stat-card ${aka.senshu ? 'active-senshu aka' : ''}`}><div className="fs-stat-label" style={{margin:0, color: aka.senshu ? '#fff' : 'inherit'}}>Senshu</div></div>
                    </div>

                    <article className="fs-fighter">
                      <div className="fs-fighter-head aka">
                        <div className="fs-lane">AKA</div>
                        <div className="fs-name">{aka.name}</div>
                      </div>
                      <div className="fs-score-stage">
                        <div className="fs-main-score aka">{aka.score}</div>
                      </div>
                      <div className="fs-fighter-foot">
                        <div className="fs-pen-title">Penalties</div>
                        <div className="fs-penalties">
                          {['c1', 'c2', 'c3', 'hc', 'h'].map((p) => (
                            <span className="fs-pen-slot" key={p}>
                              <span className="fs-pen-code">{p.toUpperCase()}</span>
                              <span className={`fs-pen-dot aka ${(aka as any)[p] ? 'active' : ''}`}></span>
                            </span>
                          ))}
                        </div>
                        <div className="fs-academy">{aka.academy}</div>
                      </div>
                    </article>

                    <div className="fs-mid">
                      <span className="fs-round-pill">Round {round}</span>
                      {compData?.scoreboardLogo && (
                        <div style={{ margin: 'auto 0', width: '160px', height: '160px', borderRadius: '24px', overflow: 'hidden', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={compData.scoreboardLogo} alt="Competition Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                      )}
                      <div className="fs-timer-label" style={{ marginTop: compData?.scoreboardLogo ? 'auto' : 'auto' }}>Time Remaining</div>
                      <div className="fs-timer" style={{ color: timer <= 10 ? 'var(--aka)' : 'inherit' }}>{mins}:{secs}</div>
                      <div className="fs-status-wrap">
                        <div className="fs-status-label">Match Status</div>
                        <span className="fs-status-pill">{status}</span>
                      </div>
                    </div>

                    <article className="fs-fighter">
                      <div className="fs-fighter-head ao">
                        <div className="fs-lane">AO</div>
                        <div className="fs-name">{ao.name}</div>
                      </div>
                      <div className="fs-score-stage">
                        <div className="fs-main-score ao">{ao.score}</div>
                      </div>
                      <div className="fs-fighter-foot">
                        <div className="fs-pen-title">Penalties</div>
                        <div className="fs-penalties">
                          {['c1', 'c2', 'c3', 'hc', 'h'].map((p) => (
                            <span className="fs-pen-slot" key={p}>
                              <span className="fs-pen-code">{p.toUpperCase()}</span>
                              <span className={`fs-pen-dot ao ${(ao as any)[p] ? 'active' : ''}`}></span>
                            </span>
                          ))}
                        </div>
                        <div className="fs-academy">{ao.academy}</div>
                      </div>
                    </article>

                    <div className="fs-stat-col">
                      <div className="fs-stat-card"><div className="fs-stat-label">Yuko</div><div className="fs-stat-value">{ao.yuko}</div></div>
                      <div className="fs-stat-card"><div className="fs-stat-label">Waza</div><div className="fs-stat-value">{ao.waza}</div></div>
                      <div className="fs-stat-card"><div className="fs-stat-label">Ippon</div><div className="fs-stat-value">{ao.ippon}</div></div>
                      <div className={`fs-stat-card ${ao.senshu ? 'active-senshu ao' : ''}`}><div className="fs-stat-label" style={{margin:0, color: ao.senshu ? '#fff' : 'inherit'}}>Senshu</div></div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* NORMAL VIEW - Kept mounted but hidden when fullscreen */}
      <div style={{ display: isFullscreen ? 'none' : 'block' }}>
      <div style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .fs-body { display: grid; grid-template-columns: 140px 1fr 200px 1fr 140px; gap: 24px; padding: 0 40px 40px; flex: 1; min-height: 0; }
        .fs-stat-col { width: 140px; display: flex; flex-direction: column; gap: 16px; flex-shrink: 0; }
        .fs-stat-card { flex: 1; background: var(--shiro); border: 1px solid var(--neutral-200); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .fs-stat-label { font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--neutral-900); letter-spacing: 0.05em; margin-bottom: 8px; }
        .fs-stat-value { font-family: var(--font-display); font-size: 32px; font-weight: 800; color: var(--ao); }
        .fs-stat-value.aka { color: var(--aka); }
        .fs-stat-card.active-senshu { background: var(--shiro); border-width: 2px; }
        .fs-stat-card.active-senshu.aka { border-color: var(--aka); background: var(--aka); color: var(--shiro); }
        .fs-stat-card.active-senshu.ao { border-color: var(--ao); background: var(--ao); color: var(--shiro); }

        .fs-fighter { background: var(--shiro); border: 1px solid var(--neutral-200); border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.04); }
        .fs-fighter-head { padding: 16px 24px; text-align: center; color: var(--shiro); flex-shrink: 0; }
        .fs-fighter-head.aka { background: var(--aka); }
        .fs-fighter-head.ao { background: var(--ao); }
        .fs-lane { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.9; margin-bottom: 4px; }
        .fs-name { font-size: clamp(22px, 3vw, 38px); font-weight: 800; line-height: 1.1; text-transform: uppercase; overflow-wrap: break-word; word-break: break-word; }
        
        .fs-score-stage { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
        .fs-main-score { font-family: var(--font-display); font-size: clamp(120px, 15vw, 240px); font-weight: 800; line-height: 1; }
        .fs-main-score.aka { color: var(--aka); }
        .fs-main-score.ao { color: var(--ao); }

        .fs-fighter-foot { padding: 16px 24px; border-top: 1px solid var(--neutral-200); text-align: center; flex-shrink: 0; }
        .fs-pen-title { font-size: 11px; font-weight: 800; color: var(--neutral-500); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
        .fs-penalties { display: flex; justify-content: center; gap: clamp(12px, 2vw, 24px); margin-bottom: 8px; }
        .fs-pen-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .fs-pen-code { font-size: 10px; font-weight: 700; color: var(--neutral-400); }
        .fs-pen-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--neutral-200); background: transparent; }
        .fs-pen-dot.aka.active { border-color: var(--aka); background: var(--aka); }
        .fs-pen-dot.ao.active { border-color: var(--ao); background: var(--ao); }
        .fs-academy { font-size: 14px; font-weight: 700; color: var(--neutral-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .fs-winner-showcase { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; border-radius: 24px; padding: 48px; text-align: center; }
        .fs-winner-showcase.aka { background: var(--aka); color: #fff; }
        .fs-winner-showcase.ao { background: var(--ao); color: #fff; }
        .fs-winner-title { font-size: clamp(40px, 5vw, 60px); font-weight: 800; letter-spacing: 0.1em; margin-bottom: 24px; text-transform: uppercase; }
        .fs-winner-name { font-family: var(--font-display); font-size: clamp(60px, 8vw, 120px); font-weight: 800; line-height: 1; text-transform: uppercase; margin-bottom: 16px; color: #fff; }
        .fs-winner-points { font-family: var(--font-display); font-size: clamp(140px, 20vw, 320px); font-weight: 800; line-height: 1; margin-bottom: 24px; color: #fff; }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-16px); } 100% { transform: translateY(0px); } }

        .fs-mid { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        .fs-round-pill { border: 1px solid var(--neutral-300); background: var(--shiro); padding: 4px 16px; border-radius: 999px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .fs-timer-label { font-size: 12px; font-weight: 800; color: var(--neutral-900); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; margin-top: auto; }
        .fs-timer { background: var(--shiro); border: 1px solid var(--neutral-200); border-radius: 16px; width: 100%; padding: 16px 0; font-family: var(--font-mono); font-size: clamp(40px, 5vw, 64px); font-weight: 800; color: var(--neutral-900); margin-bottom: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.03); }
        .fs-status-wrap { width: 100%; background: var(--shiro); border: 1px solid var(--neutral-200); border-radius: 16px; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); margin-top: auto; }
        .fs-status-label { font-size: 11px; font-weight: 800; color: var(--neutral-500); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
        .fs-status-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; background: var(--neutral-100); color: var(--neutral-600); }

        .ops-grid { display: grid; grid-template-columns: 1fr; gap: var(--space-6); margin-top: var(--space-6); }
        .ops-scoreboard { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 16px; overflow: visible; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
        .ops-header { padding: 20px 24px; border-bottom: 1px solid var(--neutral-200); background: var(--neutral-50); display: flex; justify-content: space-between; align-items: center; border-radius: 16px 16px 0 0; }
        
        .ops-display { display: grid; grid-template-columns: 1fr 200px 1fr; border-bottom: 1px solid var(--neutral-200); background: white; }
        .ops-side { padding: 24px; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .ops-side.aka { background: rgba(225, 29, 72, 0.03); border-right: 1px solid var(--neutral-200); }
        .ops-side.ao { background: rgba(26, 77, 181, 0.03); border-left: 1px solid var(--neutral-200); }
        
        .ops-country { font-size: 13px; font-weight: 800; color: var(--neutral-500); letter-spacing: 0.1em; }
        .ops-name { font-size: 32px; font-weight: 800; color: var(--neutral-900); text-transform: uppercase; margin-bottom: 4px; }
        .ops-academy { font-size: 13px; color: var(--neutral-600); font-weight: 600; margin-bottom: 16px; }
        .ops-score-num { font-family: var(--font-display); font-size: 120px; font-weight: 800; line-height: 1; margin-bottom: 24px; }
        .ops-score-num.aka { color: var(--aka); }
        .ops-score-num.ao { color: var(--ao); }
        
        .penalty-track { display: flex; gap: 16px; }
        .pen-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .pen-code { font-size: 10px; font-weight: 700; color: var(--neutral-400); }
        .pen-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--neutral-300); cursor: pointer; }
        .ops-side.aka .pen-dot.active { border-color: var(--aka); background: var(--aka); }
        .ops-side.ao .pen-dot.active { border-color: var(--ao); background: var(--ao); }

        .ops-center { justify-content: center; background: var(--shiro); }
        .ops-timer { font-family: var(--font-mono); font-size: 48px; font-weight: 800; margin-bottom: 24px; color: var(--neutral-900); }
        .ops-timer.live { color: var(--status-live); }

        .ops-controls { display: grid; grid-template-columns: 1fr; background: var(--shiro); }
        .control-panel { padding: 24px; border-bottom: 1px solid var(--neutral-200); }
        .control-row { display: flex; justify-content: center; gap: 12px; margin-bottom: 12px; }
        .control-row:last-child { margin-bottom: 0; }
        
        .btn-score { flex: 1; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; border: 1px solid var(--neutral-300); background: var(--shiro); transition: 0.15s; }
        .btn-score.aka { color: var(--aka); border-color: rgba(225, 29, 72, 0.2); }
        .btn-score.aka:hover { background: var(--aka); color: var(--shiro); }
        .btn-score.ao { color: var(--ao); border-color: rgba(26, 77, 181, 0.2); }
        .btn-score.ao:hover { background: var(--ao); color: var(--shiro); }
        .btn-score.minus { opacity: 0.7; font-size: 12px; padding: 8px; }
        .btn-score.minus:hover { opacity: 1; }

        .btn-pen { padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--neutral-200); background: var(--neutral-50); color: var(--neutral-600); }
        .btn-pen:hover { background: var(--neutral-200); }

        .round-ops-strip { padding: 16px 24px; background: var(--neutral-50); border-bottom: 1px solid var(--neutral-200); display: flex; justify-content: space-between; align-items: center; }
        .btn-round { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--neutral-300); background: var(--shiro); }
        .btn-round:hover { background: var(--neutral-100); }

        .mat-detail-grid { display: grid; grid-template-columns: 1fr 360px; gap: 24px; margin-top: 24px; }

        @media (max-width: 1024px) {
          .mat-detail-grid { grid-template-columns: 1fr; }
          .fs-body { grid-template-columns: 1fr; padding: 0 20px 20px; overflow-y: auto; }
          .fs-stat-col { flex-direction: row; }
        }
        @media (max-width: 768px) {
          .ops-display { grid-template-columns: 1fr; }
          .ops-side.aka { border-right: none; border-bottom: 1px solid var(--neutral-200); }
          .ops-side.ao { border-left: none; border-top: 1px solid var(--neutral-200); }
          .ops-score-num { font-size: 80px; }
          .ops-timer { font-size: 32px; }
          .control-row { flex-wrap: wrap; }
          .btn-score { min-width: 45%; }
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--neutral-500)', letterSpacing: '0.1em' }}>
              {compData?.name ? compData.name.toUpperCase() : 'TOURNAMENT'} • {activeCategoryName ? activeCategoryName.toUpperCase() : 'NO CATEGORY'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <h1 style={{ fontSize: '40px', margin: 0 }}>{new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('mat') ? `Mat ${new URLSearchParams(window.location.search).get('mat')?.replace('mat-', '').padStart(2, '0')}` : 'Mat 01'}</h1>
              <span className="status-chip status-live">Live</span>
              {activeCategoryName && (
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--neutral-500)', marginLeft: '12px' }}>
                  {activeCategoryName} {queue.find(m => m.id === activeMatchId)?.pool ? `(Pool ${queue.find(m => m.id === activeMatchId)?.pool})` : ''}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {!isViewer && (
              <>
                <button className="btn btn-primary" onClick={handleStartCategory}><Play size={16} /> Start Category</button>
                <button className="btn btn-secondary" onClick={handleFinishCategory}><Flag size={16} /> Finish Category</button>
                <button className="btn btn-secondary" onClick={handleNextCategory}>Next Category</button>
              </>
            )}
            <button className="btn btn-primary" onClick={() => {
              document.documentElement.requestFullscreen().catch(()=>{});
            }}>
              <Maximize size={16} /> View Scoreboard Fullscreen
            </button>
          </div>
        </header>
        
        <div className="mat-detail-grid">
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <section className="ops-scoreboard">
              <div className="ops-header">
                <div>
                  <div style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Current Category</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{activeCategoryName || 'No Active Category'} {activeCategoryData?.isKata && <span style={{ marginLeft: 6, padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: 4, fontSize: 11, fontWeight: 800 }}>KATA</span>}</div>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Match ID</div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{queue.find(m => m.id === activeMatchId)?.displayId || '—'}</div>
                  </div>
                </div>
              </div>

              {/* ── KATA GATE: If category isKata, render KataOperatorPanel; otherwise render existing Kumite controls ── */}
              {activeCategoryData?.isKata && activeMatchId ? (
                <div id="ops-display-container" style={{ padding: '24px', background: 'white' }}>
                  {isViewer ? (
                    <div style={{ padding: '24px', background: 'var(--neutral-900)', borderRadius: '12px', display: 'flex', justifyContent: 'center', gap: '32px', color: 'white' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{ background: 'var(--aka)', color: 'white', padding: '4px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>AKA</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>{aka.name}</div>
                        <div style={{ fontSize: '72px', fontWeight: 900, lineHeight: 1, color: 'var(--aka)' }}>{kataVotes?.aka || 0}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: '12px', color: 'var(--neutral-500)', fontWeight: 800, letterSpacing: '0.1em' }}>VOTES</div>
                        {kataWinner && <div style={{ marginTop: '16px', padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '14px', fontWeight: 700 }}>{kataWinner === 'tie_pending' ? 'TIE' : (kataWinner === 'aka' ? aka.name : ao.name) + ' WINS'}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{ background: 'var(--ao)', color: 'white', padding: '4px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>AO</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>{ao.name}</div>
                        <div style={{ fontSize: '72px', fontWeight: 900, lineHeight: 1, color: 'var(--ao)' }}>{kataVotes?.ao || 0}</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div id="ops-display-container" className="ops-display" style={{ marginBottom: '24px' }}>
                        <div className="ops-side aka">
                          <div className="ops-country">{aka.country}</div>
                          <div className="ops-name">{aka.name}</div>
                          <div className="ops-academy">{aka.academy}</div>
                        </div>

                        <div className="ops-side ops-center">
                          <div style={{ border: '1px solid var(--neutral-300)', padding: '4px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '24px' }}>Round {round}</div>
                          <div style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Remaining</div>
                          <div className={`ops-timer ${running ? 'live' : ''}`}>{Math.floor(timer / 60).toString().padStart(2, '0')}:{(timer % 60).toString().padStart(2, '0')}</div>
                          <div style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Match Status</div>
                          <div style={{ background: 'var(--neutral-100)', padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-600)' }}>{status}</div>
                        </div>

                        <div className="ops-side ao">
                          <div className="ops-country">{ao.country}</div>
                          <div className="ops-name">{ao.name}</div>
                          <div className="ops-academy">{ao.academy}</div>
                        </div>
                      </div>

                      <KataOperatorPanel
                        competitionId={id}
                        categoryId={activeCategoryId!}
                        matchId={activeMatchId}
                        matId={typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('mat') || 'mat-1') : 'mat-1'}
                        akaName={aka.name}
                        aoName={ao.name}
                        akaAcademy={aka.academy}
                        aoAcademy={ao.academy}
                        akaId={queue.find(m => m.id === activeMatchId)?.akaId}
                        aoId={queue.find(m => m.id === activeMatchId)?.aoId}
                        numberOfJudges={activeCategoryData?.numberOfJudges || 5}
                        allowedKataNumbers={activeCategoryData?.allowedKataList || []}
                        kataFormat={activeCategoryData?.kataFormat || 'elimination'}
                        isTeam={activeCategoryData?.isTeam || false}
                        onMatchFinished={(winner, votes, selectedKata) => {
                          const currentMatch = queue.find(m => m.id === activeMatchId);
                          const winnerId = winner === 'aka' ? currentMatch?.akaId : currentMatch?.aoId;
                          if (currentMatch) {
                            setRecentMatches(prev => [{ ...currentMatch, status: 'completed', winnerId, kataVotes: votes }, ...prev].slice(0, 3));
                            setQueue(prev => prev.filter(m => m.id !== activeMatchId));
                          }
                          setWinnerState({ color: winner, name: winner === 'aka' ? aka.name : ao.name, academy: winner === 'aka' ? aka.academy : ao.academy, points: votes[winner] });
                          fetch(`/api/competitions/${id}/brackets/${activeCategoryId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ matchId: activeMatchId, winnerId, selectedKata }),
                          }).then(r => r.json()).then(data => {
                            if (data.success) toast.success('Kata bout result saved!');
                            else toast.error('Failed to save result: ' + data.error);
                          }).catch(() => toast.error('Network error saving kata result'));
                        }}
                      />
                      {/* Kata Next Match / Reset controls */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                        <button className="btn-round" onClick={handleNextMatch}>Next Match</button>
                        <button className="btn-round" style={{ color: 'var(--aka)', borderColor: 'rgba(225,29,72,0.3)' }} onClick={() => {
                          setRound(1); setWinnerState(null);
                          const next = queue.find(m => m.id !== activeMatchId);
                          if (next) loadMatch(next);
                        }}>↺ Reset / Load Next</button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                {isViewer ? (
                  <div id="ops-display-container" style={{ background: '#fdfbfb', padding: '24px 0', borderBottom: '1px solid var(--neutral-200)', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ minWidth: '1000px', transform: 'scale(0.85)', transformOrigin: 'top center', marginBottom: '-60px' }}>
                      <div className="fs-body" style={{ display: winnerState ? 'flex' : 'grid', height: winnerState ? '100%' : 'auto' }}>
                        {winnerState ? (
                          <div style={{ flex: 1, padding: '24px 0', display: 'flex', flexDirection: 'column' }}>
                            <div className={`fs-winner-showcase ${winnerState.color}`}>
                              <div className="fs-winner-title">{winnerState.color === 'aka' ? 'AKA WINS' : 'AO WINS'}</div>
                              <div className="fs-winner-points">{winnerState.points}</div>
                              <div className="fs-winner-name">{winnerState.name}</div>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* AKA STATS */}
                            <div className="fs-stat-col">
                              <div className="fs-stat-card"><div className="fs-stat-label">Yuko</div><div className="fs-stat-value aka">{aka.yuko}</div></div>
                              <div className="fs-stat-card"><div className="fs-stat-label">Waza</div><div className="fs-stat-value aka">{aka.waza}</div></div>
                              <div className="fs-stat-card"><div className="fs-stat-label">Ippon</div><div className="fs-stat-value aka">{aka.ippon}</div></div>
                              <div className={`fs-stat-card ${aka.senshu ? 'active-senshu aka' : ''}`}><div className="fs-stat-label" style={{margin:0, color: aka.senshu ? '#fff' : 'inherit'}}>Senshu</div></div>
                            </div>

                            {/* AKA CARD */}
                            <article className="fs-fighter">
                              <div className="fs-fighter-head aka">
                                <div className="fs-lane">AKA</div>
                                <div className="fs-name">{aka.name}</div>
                              </div>
                              <div className="fs-score-stage">
                                <div className="fs-main-score aka">{aka.score}</div>
                              </div>
                              <div className="fs-fighter-foot">
                                <div className="fs-pen-title">Penalties</div>
                                <div className="fs-penalties">
                                  {['c1', 'c2', 'c3', 'hc', 'h'].map((p) => (
                                    <span className="fs-pen-slot" key={p}>
                                      <span className="fs-pen-code">{p.toUpperCase()}</span>
                                      <span className={`fs-pen-dot aka ${(aka as any)[p] ? 'active' : ''}`}></span>
                                    </span>
                                  ))}
                                </div>
                                <div className="fs-academy">{aka.academy}</div>
                              </div>
                            </article>

                            {/* MIDDLE */}
                            <div className="fs-mid">
                              <span className="fs-round-pill">Round {round}</span>
                              {compData?.scoreboardLogo && (
                                <div style={{ margin: 'auto 0', width: '160px', height: '160px', borderRadius: '24px', overflow: 'hidden', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <img src={compData.scoreboardLogo} alt="Competition Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                </div>
                              )}
                              <div className="fs-timer-label" style={{ marginTop: compData?.scoreboardLogo ? 'auto' : 'auto' }}>Time Remaining</div>
                              <div className="fs-timer" style={{ color: timer <= 10 ? 'var(--aka)' : 'inherit' }}>{mins}:{secs}</div>
                              <div className="fs-status-wrap">
                                <div className="fs-status-label">Match Status</div>
                                <span className="fs-status-pill">{status}</span>
                              </div>
                            </div>

                            {/* AO CARD */}
                            <article className="fs-fighter">
                              <div className="fs-fighter-head ao">
                                <div className="fs-lane">AO</div>
                                <div className="fs-name">{ao.name}</div>
                              </div>
                              <div className="fs-score-stage">
                                <div className="fs-main-score ao">{ao.score}</div>
                              </div>
                              <div className="fs-fighter-foot">
                                <div className="fs-pen-title">Penalties</div>
                                <div className="fs-penalties">
                                  {['c1', 'c2', 'c3', 'hc', 'h'].map((p) => (
                                    <span className="fs-pen-slot" key={p}>
                                      <span className="fs-pen-code">{p.toUpperCase()}</span>
                                      <span className={`fs-pen-dot ao ${(ao as any)[p] ? 'active' : ''}`}></span>
                                    </span>
                                  ))}
                                </div>
                                <div className="fs-academy">{ao.academy}</div>
                              </div>
                            </article>

                            {/* AO STATS */}
                            <div className="fs-stat-col">
                              <div className="fs-stat-card"><div className="fs-stat-label">Yuko</div><div className="fs-stat-value">{ao.yuko}</div></div>
                              <div className="fs-stat-card"><div className="fs-stat-label">Waza</div><div className="fs-stat-value">{ao.waza}</div></div>
                              <div className="fs-stat-card"><div className="fs-stat-label">Ippon</div><div className="fs-stat-value">{ao.ippon}</div></div>
                              <div className={`fs-stat-card ${ao.senshu ? 'active-senshu ao' : ''}`}><div className="fs-stat-label" style={{margin:0, color: ao.senshu ? '#fff' : 'inherit'}}>Senshu</div></div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
              <div id="ops-display-container" className="ops-display">
                <div className="ops-side aka">
                  <div className="ops-country">{aka.country}</div>
                  <div className="ops-name">{aka.name}</div>
                  <div className="ops-academy">{aka.academy}</div>
                  <div className="ops-score-num aka">{aka.score}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '8px' }}>Penalties</div>
                  <div className="penalty-track">
                    {['c1', 'c2', 'c3', 'hc', 'h'].map((p) => (
                      <div className="pen-slot" key={p}>
                        <span className="pen-code">{p.toUpperCase()}</span>
                        <div className={`pen-dot ${(aka as any)[p] ? 'active' : ''}`} onClick={() => !isViewer && togglePenalty('aka', p as any)}></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ops-side ops-center">
                  <div style={{ border: '1px solid var(--neutral-300)', padding: '4px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '24px' }}>Round {round}</div>
                  <div style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Remaining</div>
                  <div className={`ops-timer ${running ? 'live' : ''}`}>{mins}:{secs}</div>
                  <div style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Match Status</div>
                  <div style={{ background: 'var(--neutral-100)', padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-600)' }}>{status}</div>
                </div>

                <div className="ops-side ao">
                  <div className="ops-country">{ao.country}</div>
                  <div className="ops-name">{ao.name}</div>
                  <div className="ops-academy">{ao.academy}</div>
                  <div className="ops-score-num ao">{ao.score}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '8px' }}>Penalties</div>
                  <div className="penalty-track">
                    {['c1', 'c2', 'c3', 'hc', 'h'].map((p) => (
                      <div className="pen-slot" key={p}>
                        <span className="pen-code">{p.toUpperCase()}</span>
                        <div className={`pen-dot ${(ao as any)[p] ? 'active' : ''}`} onClick={() => !isViewer && togglePenalty('ao', p as any)}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              )}

              {!isViewer && (
              <div className="ops-controls">
                <div className="round-ops-strip" style={{ borderBottom: '1px solid var(--neutral-200)', background: 'var(--shiro)' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>Round Operations</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-round" onClick={() => setRunning(true)}><Play size={14} /> Start Round</button>
                    <button className="btn-round" onClick={() => setRunning(false)}><Pause size={14} /> Stop Round</button>
                    <button className="btn-round" onClick={() => {
                       setRound(r => r + 1);
                       setAka(p => ({ ...p, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false }));
                       setAo(p => ({ ...p, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false }));
                       setTimer(matchDuration);
                       setRunning(false);
                    }}>New Round</button>
                    <button className="btn-round" style={{ color: 'var(--aka)', borderColor: 'rgba(225,29,72,0.3)' }} onClick={() => {
                      setAka(p => ({ ...p, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false }));
                      setAo(p => ({ ...p, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false }));
                      setTimer(matchDuration);
                      setRunning(false);
                    }}>↺ Reset Round</button>
                  </div>
                </div>
                <div className="round-ops-strip" style={{ flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '14px' }}>
                    Match Operations
                    <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--neutral-500)', borderLeft: '1px solid var(--neutral-200)', paddingLeft: '10px' }}>Timer:</span>
                    <input
                      type="number"
                      min="1" max="99"
                      value={Math.floor(matchDuration / 60)}
                      onChange={e => {
                        const mins = Math.max(0, parseInt(e.target.value) || 0);
                        const secs = matchDuration % 60;
                        const newDur = mins * 60 + secs;
                        setMatchDuration(newDur);
                        setTimer(newDur);
                      }}
                      style={{ width: '52px', padding: '4px 8px', border: '1px solid var(--neutral-300)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--neutral-500)' }}>min</span>
                    <input
                      type="number"
                      min="0" max="59"
                      value={matchDuration % 60}
                      onChange={e => {
                        const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                        const mins = Math.floor(matchDuration / 60);
                        const newDur = mins * 60 + secs;
                        setMatchDuration(newDur);
                        setTimer(newDur);
                      }}
                      style={{ width: '52px', padding: '4px 8px', border: '1px solid var(--neutral-300)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--neutral-500)' }}>sec</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-round" onClick={handleNextMatch}>Next Match</button>
                    <button className="btn-round" onClick={handleFinishMatch}><Flag size={14} /> Finish Match</button>
                    <button className="btn-round" style={{ color: 'var(--aka)', borderColor: 'rgba(225,29,72,0.3)' }} onClick={() => {
                      setRound(1);
                      setAka(p => ({ ...p, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false }));
                      setAo(p => ({ ...p, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false }));
                      setTimer(matchDuration);
                      setRunning(false);
                      setStatus('upcoming');
                      setWinnerState(null);
                    }}>↺ Reset Match</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px', borderBottom: '1px solid var(--neutral-200)' }}>
                  
                  {/* AKA Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="control-row" style={{ margin: 0 }}>
                      <button className="btn-score aka" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', 1)}>+1 Yuko</button>
                      <button className="btn-score aka" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', 2)}>+2 Waza</button>
                      <button className="btn-score aka" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', 3)}>+3 Ippon</button>
                    </div>
                    <div className="control-row" style={{ margin: 0 }}>
                      <button className="btn-score aka minus" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', -1)}>-1 Yuko</button>
                      <button className="btn-score aka minus" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', -2)}>-2 Waza</button>
                      <button className="btn-score aka minus" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', -3)}>-3 Ippon</button>
                    </div>
                    <div className="control-row" style={{ flexWrap: 'wrap', marginTop: '12px' }}>
                      <button className="btn-pen" onClick={() => toggleSenshu('aka')} style={{ background: aka.senshu ? 'var(--aka)' : 'var(--shiro)', color: aka.senshu ? '#fff' : 'var(--neutral-900)', borderColor: aka.senshu ? 'var(--aka)' : 'var(--neutral-300)', flex: '1 1 45%' }}>Senshu (AKA)</button>
                      <button className="btn-pen" style={{ color: 'var(--aka)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('aka', 'c1')}>+ Penalty (C1)</button>
                      <button className="btn-pen" style={{ color: 'var(--aka)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('aka', 'c2')}>+ Penalty (C2)</button>
                      <button className="btn-pen" style={{ color: 'var(--aka)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('aka', 'c3')}>+ Penalty (C3)</button>
                      <button className="btn-pen" style={{ color: 'var(--aka)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('aka', 'hc')}>+ Penalty (HC)</button>
                      <button className="btn-pen" style={{ color: 'var(--aka)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('aka', 'h')}>+ Penalty (H)</button>
                      <button className="btn-pen" style={{ color: 'var(--shiro)', flex: '1 1 45%', background: 'var(--aka)', borderColor: 'var(--aka)', fontWeight: 800 }} onClick={() => handleDisqualify('aka')}>Disqualify AKA</button>
                    </div>
                  </div>

                  {/* AO Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="control-row" style={{ margin: 0 }}>
                      <button className="btn-score ao" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', 1)}>+1 Yuko</button>
                      <button className="btn-score ao" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', 2)}>+2 Waza</button>
                      <button className="btn-score ao" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', 3)}>+3 Ippon</button>
                    </div>
                    <div className="control-row" style={{ margin: 0 }}>
                      <button className="btn-score ao minus" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', -1)}>-1 Yuko</button>
                      <button className="btn-score ao minus" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', -2)}>-2 Waza</button>
                      <button className="btn-score ao minus" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', -3)}>-3 Ippon</button>
                    </div>
                    <div className="control-row" style={{ flexWrap: 'wrap', marginTop: '12px' }}>
                      <button className="btn-pen" onClick={() => toggleSenshu('ao')} style={{ background: ao.senshu ? 'var(--ao)' : 'var(--shiro)', color: ao.senshu ? '#fff' : 'var(--neutral-900)', borderColor: ao.senshu ? 'var(--ao)' : 'var(--neutral-300)', flex: '1 1 45%' }}>Senshu (AO)</button>
                      <button className="btn-pen" style={{ color: 'var(--ao)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('ao', 'c1')}>+ Penalty (C1)</button>
                      <button className="btn-pen" style={{ color: 'var(--ao)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('ao', 'c2')}>+ Penalty (C2)</button>
                      <button className="btn-pen" style={{ color: 'var(--ao)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('ao', 'c3')}>+ Penalty (C3)</button>
                      <button className="btn-pen" style={{ color: 'var(--ao)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('ao', 'hc')}>+ Penalty (HC)</button>
                      <button className="btn-pen" style={{ color: 'var(--ao)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('ao', 'h')}>+ Penalty (H)</button>
                      <button className="btn-pen" style={{ color: 'var(--shiro)', flex: '1 1 45%', background: 'var(--aka)', borderColor: 'var(--aka)', fontWeight: 800 }} onClick={() => handleDisqualify('ao')}>Disqualify AO</button>
                    </div>
                  </div>

                </div>
              </div>
              )}
                </>
              )}
            </section>

            <section style={{ marginTop: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Match Queue</h2>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    placeholder="Search athletes..."
                    value={queueSearchQuery}
                    onChange={(e) => setQueueSearchQuery(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }}
                  />
                  <select 
                    value={queueFilterPool} 
                    onChange={(e) => setQueueFilterPool(e.target.value)}
                    style={{ 
                      padding: '6px 12px', fontSize: '13px', border: '1px solid var(--neutral-300)', borderRadius: '6px',
                      backgroundColor: queueFilterPool && poolStatuses[queueFilterPool] ? '#d1fae5' : 'white',
                      color: queueFilterPool && poolStatuses[queueFilterPool] ? '#065f46' : 'inherit'
                    }}
                  >
                    {Object.keys(poolStatuses).sort((a,b) => parseInt(a) - parseInt(b)).map(p => (
                      <option key={p} value={p}>Pool {p} {poolStatuses[p] ? '✅' : '🔴'}</option>
                    ))}
                  </select>
                  {!isViewer && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => { setTempQueue([...queue]); setShowEditModal(true); }}
                    style={{ fontSize: '13px', padding: '6px 16px', background: 'var(--shiro)' }}
                  >
                    Edit Queue
                  </button>
                  )}
                </div>
              </div>
              <div style={{ background: 'var(--shiro)', border: '1px solid var(--neutral-200)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div className="table-responsive">
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-200)' }}>
                    <tr>
                      <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID</th>
                      <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Match-up</th>
                      <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                      <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueFilterPool && poolStatuses[queueFilterPool] && visibleQueue.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px 20px', textAlign: 'center', background: '#ecfdf5' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Flag size={24} color="#10b981" />
                            </div>
                            <div style={{ color: '#065f46', fontWeight: 800, fontSize: '16px' }}>Pool {queueFilterPool} is Completed!</div>
                            <div style={{ color: '#047857', fontSize: '13px' }}>Medal results have been saved.</div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {(!queueFilterPool || !poolStatuses[queueFilterPool] || visibleQueue.length > 0) && visibleQueue.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                          No matches in queue for {activeCategoryName || 'this mat'}.
                        </td>
                      </tr>
                    )}
                    {visibleQueue.length > 0 && visibleQueue.map((match, idx) => (
                        <tr 
                          key={match.id}
                          draggable={!isViewer}
                          onDragStart={(e) => !isViewer && handleDragStart(e, idx)}
                          onDragOver={(e) => !isViewer && e.preventDefault()}
                          onDrop={(e) => !isViewer && handleDropQueue(e, idx)}
                          style={{  
                            borderBottom: '1px solid var(--neutral-100)',
                            cursor: 'grab',
                            backgroundColor: match.pool && poolStatuses[match.pool] ? '#ecfdf5' : (draggedIdx === idx ? 'var(--neutral-50)' : 'transparent'),
                            opacity: draggedIdx === idx ? 0.5 : 1
                          }}
                        >
                          <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: idx === 0 ? 'inherit' : 'var(--neutral-500)' }}>{match.displayId}</td>
                          <td style={{ padding: '16px 20px', fontWeight: idx === 0 ? 800 : 700, fontSize: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span>{match.aka}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--neutral-500)', fontWeight: 500 }}>{match.akaAcademy || 'Unattached'}</span>
                                </div>
                                <span style={{ color: 'var(--neutral-400)', margin: '0 8px', fontWeight: 500 }}>vs</span> 
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span>{match.ao}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--neutral-500)', fontWeight: 500 }}>{match.aoAcademy || 'Unattached'}</span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <span style={{ color: match.akaReady ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: match.akaReady ? '#10b981' : '#ef4444' }}></div>
                                  AKA {match.akaReady ? 'READY' : 'NOT READY'}
                                </span>
                                <span style={{ color: 'var(--neutral-300)' }}>•</span>
                                <span style={{ color: match.aoReady ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: match.aoReady ? '#10b981' : '#ef4444' }}></div>
                                  AO {match.aoReady ? 'READY' : 'NOT READY'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px', color: 'var(--neutral-600)', fontSize: '14px' }}>{match.category}</td>
                          <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                            {match.id === activeMatchId ? (
                              <span style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>LIVE / CURRENT</span>
                            ) : idx === 0 || (idx === 1 && visibleQueue[0]?.id === activeMatchId) ? (
                              <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>NEXT</span>
                            ) : (
                              <span style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>STANDBY</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                </div>
              </div>
            </section>
          </div>

          <aside>
            {isViewer ? (
              <>
              <style dangerouslySetInnerHTML={{__html: `
                #mat-leaderboard-container:fullscreen {
                  width: 100vw; height: 100vh; padding: 64px; border-radius: 0; overflow-y: auto; margin: 0; display: flex; flex-direction: column; gap: 16px;
                }
                #mat-leaderboard-container:fullscreen .lb-title { font-size: 32px !important; margin-bottom: 32px !important; }
                #mat-leaderboard-container:fullscreen .lb-item { padding: 32px !important; border-radius: 16px !important; gap: 24px !important; }
                #mat-leaderboard-container:fullscreen .lb-rank { width: 64px !important; height: 64px !important; font-size: 28px !important; }
                #mat-leaderboard-container:fullscreen .lb-academy { font-size: 28px !important; }
                #mat-leaderboard-container:fullscreen .lb-pts { font-size: 40px !important; }
                #mat-leaderboard-container:fullscreen .lb-pts span { font-size: 20px !important; }
                #mat-leaderboard-container:-webkit-full-screen { width: 100vw; height: 100vh; }
              `}} />
              <div id="mat-leaderboard-container" style={{ background: 'var(--shiro)', borderRadius: '16px', padding: '16px', border: '1px solid var(--neutral-200)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', marginBottom: '24px' }}>
                <div className="lb-title" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Mat Leaderboard</div>
                  <button onClick={() => {
                    const el = document.getElementById('mat-leaderboard-container');
                    if (el && el.requestFullscreen) {
                      el.requestFullscreen();
                    }
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-500)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700 }}>
                    <Maximize size={12} /> FULLSCREEN
                  </button>
                </div>
                {(() => {
                  const matStats: Record<string, { gold: number, silver: number, bronze: number, points: number }> = {};
                  matCategories.forEach(cat => {
                    (cat.athletes || []).forEach((ath: any) => {
                      if (ath.medal) {
                        const academy = ath.academy || 'Unknown';
                        if (!matStats[academy]) matStats[academy] = { gold: 0, silver: 0, bronze: 0, points: 0 };
                        if (ath.medal === 'gold') {
                          matStats[academy].gold += 1;
                          matStats[academy].points += 3;
                        } else if (ath.medal === 'silver') {
                          matStats[academy].silver += 1;
                          matStats[academy].points += 2;
                        } else if (ath.medal === 'bronze') {
                          matStats[academy].bronze += 1;
                          matStats[academy].points += 1;
                        }
                      }
                    });
                  });
                  const leaderboard = Object.entries(matStats).map(([academy, stats]) => ({ academy, ...stats }));
                  leaderboard.sort((a, b) => b.points - a.points || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);
                  
                  if (leaderboard.length === 0) {
                    return <div style={{ color: 'var(--neutral-500)', fontSize: '13px' }}>No medals awarded yet.</div>;
                  }
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {leaderboard.map((entry, idx) => (
                        <div key={entry.academy} className="lb-item" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--neutral-200)', borderRadius: '10px', background: idx < 3 ? 'var(--shiro)' : 'var(--neutral-50)' }}>
                          <div className="lb-rank" style={{ width: '24px', height: '24px', borderRadius: '50%', background: idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : idx === 2 ? '#d97706' : 'var(--neutral-200)', color: idx < 3 ? 'white' : 'var(--neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>
                            {idx + 1}
                          </div>
                          <div className="lb-academy" style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: 'var(--neutral-900)' }}>
                            {entry.academy}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span className="lb-pts" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--neutral-900)' }}>{entry.points} <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase' }}>pts</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Skipped Categories</h2>
                </div>
                
                <div style={{ background: 'var(--shiro)', borderRadius: '16px', padding: '16px', border: '1px solid var(--neutral-200)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', marginBottom: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>Categories marked as skipped on this mat</div>
                  {skippedCategories.length === 0 ? (
                    <div style={{ color: 'var(--neutral-500)', fontSize: '13px' }}>No skipped categories.</div>
                  ) : (
                    skippedCategories.map((cat: any) => (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', padding: '12px', background: 'var(--neutral-50)', borderRadius: '10px', border: '1px solid var(--neutral-200)' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{cat.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>SKIPPED</div>
                        </div>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '12px', padding: '5px 12px', whiteSpace: 'nowrap' }}
                          onClick={() => handleRestoreSkipped(cat.id, cat.name)}
                        >
                          Restore
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            <div style={{ background: 'var(--neutral-50)', border: '1px dashed var(--neutral-300)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>Recent Results ({activeCategoryName || 'No Active Category'})</div>
              
              {recentMatches.length === 0 ? (
                <div style={{ color: 'var(--neutral-500)', fontSize: '13px' }}>Category yet to begin</div>
              ) : (
                recentMatches.map((m, i) => {
                  const akaName = m.aka?.name || 'Empty Slot';
                  const aoName = m.ao?.name || 'Empty Slot';
                  const akaWon = m.winnerId === m.aka?.playerId || m.winnerId === m.aka?.name;
                  const aoWon = m.winnerId === m.ao?.playerId || m.winnerId === m.ao?.name;
                  
                  return (
                    <div key={m.id} style={{ fontSize: '13px', borderBottom: i < recentMatches.length - 1 ? '1px solid var(--neutral-200)' : 'none', paddingBottom: i < recentMatches.length - 1 ? '16px' : '0', marginBottom: i < recentMatches.length - 1 ? '16px' : '0', padding: m.pool && poolStatuses[m.pool] ? '8px' : '0', borderRadius: m.pool && poolStatuses[m.pool] ? '8px' : '0', backgroundColor: m.pool && poolStatuses[m.pool] ? '#d1fae5' : 'transparent' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginRight: '12px', color: 'var(--neutral-500)' }}>{m.matchNumber ? `M${String(m.matchNumber).padStart(2, '0')}` : m.id}</span> 
                      {akaWon ? (
                        aoName === 'Empty Slot' ? (
                          <><span style={{ fontWeight: 700, color: 'var(--aka)' }}>{akaName}</span> advanced via BYE</>
                        ) : (
                          <><span style={{ fontWeight: 700, color: 'var(--aka)' }}>{akaName}</span> def. {aoName}</>
                        )
                      ) : aoWon ? (
                        akaName === 'Empty Slot' ? (
                          <><span style={{ fontWeight: 700, color: 'var(--ao)' }}>{aoName}</span> advanced via BYE</>
                        ) : (
                          <><span style={{ fontWeight: 700, color: 'var(--ao)' }}>{aoName}</span> def. {akaName}</>
                        )
                      ) : (
                        <>{akaName} vs {aoName} (Completed)</>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </aside>

        </div>
      </main>

      {/* Leaderboard fullscreen — removed, replaced by Skipped Categories panel */}
      {showEditModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal" style={{ background: 'var(--shiro)', width: '600px', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh', boxShadow: '0 24px 48px rgba(0,0,0,0.1)' }}>
            <div className="modal-header" style={{ padding: '24px', borderBottom: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Edit Full Match Queue</h3>
              <button className="close-btn" onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-500)' }}><span style={{fontSize:'20px'}}>×</span></button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              <div className="table-responsive">
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--neutral-50)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--neutral-200)' }}>ID</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--neutral-200)' }}>Match-up</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--neutral-200)' }}>Category</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', borderBottom: '1px solid var(--neutral-200)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tempQueue.map((match, idx) => (
                    <tr 
                      key={match.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropModal(e, idx)}
                      style={{ 
                        borderBottom: '1px solid var(--neutral-100)',
                        cursor: 'grab',
                        backgroundColor: draggedIdx === idx ? 'var(--neutral-50)' : 'transparent',
                        opacity: draggedIdx === idx ? 0.5 : 1
                      }}
                    >
                      <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: idx === 0 ? 'inherit' : 'var(--neutral-500)' }}>{match.id}</td>
                      <td style={{ padding: '16px 20px', fontWeight: idx === 0 ? 800 : 700, fontSize: '14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div>{match.aka.split(' ')[0]} <span style={{ color: 'var(--neutral-400)', margin: '0 8px', fontWeight: 500 }}>vs</span> {match.ao.split(' ')[0]}</div>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <span style={{ color: match.akaReady ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: match.akaReady ? '#10b981' : '#ef4444' }}></div>
                              AKA {match.akaReady ? 'READY' : 'NOT READY'}
                            </span>
                            <span style={{ color: 'var(--neutral-300)' }}>•</span>
                            <span style={{ color: match.aoReady ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: match.aoReady ? '#10b981' : '#ef4444' }}></div>
                              AO {match.aoReady ? 'READY' : 'NOT READY'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--neutral-600)', fontSize: '14px' }}>{match.category}</td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        {idx === 0 ? (
                          <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>NEXT</span>
                        ) : (
                          <span style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>STANDBY</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '24px', borderTop: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--neutral-50)' }}>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)} style={{ fontSize: '13px', fontWeight: 600 }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { setQueue(tempQueue); setShowEditModal(false); }} style={{ fontSize: '13px', fontWeight: 600 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
      </div>
      </div>
    </PasswordGateway>
  );
}
