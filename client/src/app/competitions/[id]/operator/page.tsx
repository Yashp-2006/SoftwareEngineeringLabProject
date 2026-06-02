'use client';

import React, { useState, useEffect } from 'react';
import { Maximize, ArrowLeft, Play, Pause, Flag, RotateCw } from 'lucide-react';
import Header from '@/components/layout/Header';
import PasswordGateway from '@/components/auth/PasswordGateway';
import { toast } from 'react-hot-toast';

export default function OperatorPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // State
  const [aka, setAka] = useState({ name: 'AKA', country: '', academy: '', score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false });
  const [ao, setAo] = useState({ name: 'AO', country: '', academy: '', score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false });
  const [timer, setTimer] = useState(180);
  const [matchDuration, setMatchDuration] = useState(180); // configurable
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<'upcoming' | 'ongoing' | 'paused' | 'finished'>('ongoing');
  const [round, setRound] = useState(1);

  const [queue, setQueue] = useState<any[]>([]);
  const [allCompletedMatches, setAllCompletedMatches] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'academy' | 'state' | 'country'>('academy');
  const [leaderboardIsFullscreen, setLeaderboardIsFullscreen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState('');
  const [compData, setCompData] = useState<any>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [tempQueue, setTempQueue] = useState<any[]>([]);
  
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [queueFilterCategory, setQueueFilterCategory] = useState('');
  const [queueFilterPool, setQueueFilterPool] = useState('');
  
  const filteredQueue = queue.filter(match => {
    let matchFullName = `${match.aka} ${match.ao}`.toLowerCase();
    let matchesSearch = queueSearchQuery ? matchFullName.includes(queueSearchQuery.toLowerCase()) : true;
    let matchesCat = queueFilterCategory ? match.category === queueFilterCategory : true;
    let matchesPool = queueFilterPool ? String(match.pool) === queueFilterPool : true;
    return matchesSearch && matchesCat && matchesPool;
  });
  const visibleQueue = filteredQueue;
  
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const leaderboard = React.useMemo(() => {
    const counts: Record<string, { name: string, country: string, wins: number }> = {};
    allCompletedMatches.forEach(m => {
      const isAka = m.winnerId === m.aka?.playerId || m.winnerId === m.aka?.name;
      const winnerData = isAka ? m.aka : m.ao;
      if (winnerData) {
        const key = winnerData[leaderboardFilter] || 'Unattached';
        if (!counts[key]) {
          counts[key] = { name: key, country: winnerData.country || winnerData.state || 'Unknown', wins: 0 };
        }
        counts[key].wins++;
      }
    });
    return Object.values(counts).sort((a, b) => b.wins - a.wins).slice(0, leaderboardIsFullscreen ? 20 : 3);
  }, [allCompletedMatches, leaderboardFilter, leaderboardIsFullscreen]);

  // RTDB sync — writes to live_scores/{id}/mats/{matId} on every state change
  useEffect(() => {
    const updateRTDB = async () => {
      try {
        const { rtdb } = await import('@lib/firebase');
        const { ref, set } = await import('firebase/database');
        
        // Mat ID from URL query param e.g. /operator?mat=mat-1
        const params = new URLSearchParams(window.location.search);
        const matId = params.get('mat') || 'mat-1';
        
        const matRef = ref(rtdb, `live_scores/${id}/mats/${matId}`);
        
        const mm = Math.floor(timer / 60).toString().padStart(2, '0');
        const ss = (timer % 60).toString().padStart(2, '0');
        
        const payload = {
          status: status === 'finished' ? 'standby' : (status === 'upcoming' ? 'upcoming' : (running ? 'live' : 'paused')),
          currentCategory: activeCategoryName || 'No Active Category',
          currentMatch: queue[0]?.displayId || 'Standby',
          // Competitor identifiers (read by live/mat/[matId] display)
          akaName: aka.name,
          akaCountry: aka.country,
          akaAcademy: aka.academy,
          aoName: ao.name,
          aoCountry: ao.country,
          aoAcademy: ao.academy,
          // Scores
          scores: {
            aka: aka.score,
            ao: ao.score,
          },
          // Individual penalties (read by live display for penalty dots)
          akaPenalties: { c1: aka.c1, c2: aka.c2, c3: aka.c3, hc: aka.hc, h: aka.h },
          aoPenalties:  { c1: ao.c1,  c2: ao.c2,  c3: ao.c3,  hc: ao.hc,  h: ao.h  },
          // Timer
          timerSeconds: timer,
          timerRunning: running,
          timeRemaining: `${mm}:${ss}`,
        };
        
        await set(matRef, payload);
      } catch (err) {
        console.error('Failed to sync RTDB', err);
      }
    };

    updateRTDB();
  }, [id, aka, ao, timer, status, running]);


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

        cats = cats.filter(c => c.status === 'live' || c.status === 'upcoming');
        cats.sort((a, b) => (a.order || 0) - (b.order || 0));

        if (cats.length > 0) {
          const activeCat = cats[0];
          setActiveCategoryId(activeCat.id);
          setActiveCategoryName(activeCat.name);
          const matches = activeCat.matches || [];
          
          const pendingMatches = matches.filter((m: any) => m.status !== 'completed');
          const completedMatches = matches.filter((m: any) => m.status === 'completed').reverse().slice(0, 3);
          setRecentMatches(completedMatches);
          
          const mappedQueue = pendingMatches.map((m: any) => ({
            id: m.id,
            displayId: m.matchNumber ? `M${String(m.matchNumber).padStart(2, '0')}` : m.id,
            aka: m.aka?.name || (m.akaFromMatchId ? `Winner M${m.akaFromMatchId}` : 'BYE'),
            akaId: m.aka?.playerId || m.aka?.name,
            akaAcademy: m.aka?.academy || '',
            akaCountry: m.aka?.country || m.aka?.state || '',
            ao: m.ao?.name || (m.aoFromMatchId ? `Winner M${m.aoFromMatchId}` : 'BYE'),
            aoId: m.ao?.playerId || m.ao?.name,
            aoAcademy: m.ao?.academy || '',
            aoCountry: m.ao?.country || m.ao?.state || '',
            category: activeCat.name,
            pool: m.pool || (m.id && m.id.includes('Pool') ? m.id.split('-')[0].replace('Pool', '') : null),
            akaReady: m.aka?.readiness === 'ready',
            aoReady: m.ao?.readiness === 'ready',
          })).filter((m: any) => !m.aka.startsWith('Winner M') && !m.ao.startsWith('Winner M'));
          setQueue(mappedQueue);
        } else {
          setQueue([]);
          setRecentMatches([]);
          setActiveCategoryId(null);
          setActiveCategoryName('');
        }
      });
    };
    setupQueue();
    return () => unsubscribe();
  }, [id]);

  const loadMatch = (m: any) => {
    setActiveMatchId(m.id);
    setAka({ name: m.aka, country: m.akaCountry, academy: m.akaAcademy, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false });
    setAo({ name: m.ao, country: m.aoCountry, academy: m.aoAcademy, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false });
    setTimer(matchDuration);
    setStatus('upcoming');
    setRound(1);
    setWinnerState(null);
  };

  useEffect(() => {
    if (queue.length > 0 && !activeMatchId) {
      loadMatch(queue[0]);
    } else if (queue.length > 0 && activeMatchId) {
       // Keep names in sync if edited externally
       const m = queue.find(q => q.id === activeMatchId);
       if (m) {
         setAka(p => ({ ...p, name: m.aka, country: m.akaCountry, academy: m.akaAcademy }));
         setAo(p => ({ ...p, name: m.ao, country: m.aoCountry, academy: m.aoAcademy }));
       }
    }
  }, [queue, activeMatchId]);

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
      
      await updateDoc(catRef, { status: 'done', actualEndTime: actualEndStr });

      const targetData = targetDoc.data();
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

  if (isFullscreen) {
    return (
      <PasswordGateway>
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fdfbfb', zIndex: 9999, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
            <div className="overlay-title">Mat 01 — <span className="overlay-title-live">Live Scoreboard</span></div>
            <div className="overlay-meta">Kyoto 2026 Finals • Senior Male Kumite -75kg • Semi-Final</div>
          </div>
          <div className="overlay-actions">
            <button className="overlay-btn" onClick={() => document.documentElement.requestFullscreen().catch(()=>{} )}>
              <Maximize size={16} /> Enter Fullscreen
            </button>
            <button className="overlay-btn return" onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              setIsFullscreen(false);
            }}>
              <ArrowLeft size={16} /> Return to Mat Operations
            </button>
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
                <div className="fs-timer-label">Time Remaining</div>
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
    </PasswordGateway>
    );
  }

  // Operator Dashboard UI
  return (
    <PasswordGateway>
      <div style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .ops-grid { display: grid; grid-template-columns: 1fr; gap: var(--space-6); margin-top: var(--space-6); }
        .ops-scoreboard { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
        .ops-header { padding: 20px 24px; border-bottom: 1px solid var(--neutral-200); background: var(--neutral-50); display: flex; justify-content: space-between; align-items: center; }
        
        .ops-display { display: grid; grid-template-columns: 1fr 200px 1fr; border-bottom: 1px solid var(--neutral-200); }
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
            <button className="btn btn-primary" onClick={handleStartCategory}><Play size={16} /> Start Category</button>
            <button className="btn btn-secondary" onClick={handleFinishCategory}><Flag size={16} /> Finish Category</button>
            <button className="btn btn-secondary" onClick={handleNextCategory}>Next Category</button>
            <button className="btn btn-primary" onClick={() => setIsFullscreen(true)}>
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
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>Senior Male Kumite -75kg <span style={{ color: 'var(--neutral-400)', fontWeight: 500 }}>• Semi-Final</span></div>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Match ID</div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>M05</div>
                  </div>
                </div>
              </div>

              <div className="ops-display">
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
                        <div className={`pen-dot ${(aka as any)[p] ? 'active' : ''}`} onClick={() => togglePenalty('aka', p as any)}></div>
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
                        <div className={`pen-dot ${(ao as any)[p] ? 'active' : ''}`} onClick={() => togglePenalty('ao', p as any)}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

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
                    </div>
                  </div>

                </div>
              </div>
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
                    value={queueFilterCategory} 
                    onChange={(e) => setQueueFilterCategory(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }}
                  >
                    <option value="">All Categories</option>
                    {Array.from(new Set(queue.map(m => m.category))).map(c => (
                      <option key={c as string} value={c as string}>{c as string}</option>
                    ))}
                  </select>
                  <select 
                    value={queueFilterPool} 
                    onChange={(e) => setQueueFilterPool(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }}
                  >
                    <option value="">All Pools</option>
                    {Array.from(new Set(queue.map(m => m.pool).filter(Boolean))).map(p => (
                      <option key={String(p)} value={String(p)}>Pool {String(p)}</option>
                    ))}
                  </select>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => { setTempQueue([...queue]); setShowEditModal(true); }}
                    style={{ fontSize: '13px', padding: '6px 16px', background: 'var(--shiro)' }}
                  >
                    Edit Queue
                  </button>
                </div>
              </div>
              <div style={{ background: 'var(--shiro)', border: '1px solid var(--neutral-200)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
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
                    {visibleQueue.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                          No matches in queue for {activeCategoryName || 'this mat'}.
                        </td>
                      </tr>
                    ) : (
                      visibleQueue.map((match, idx) => (
                        <tr 
                          key={match.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDropQueue(e, idx)}
                          style={{ 
                            borderBottom: '1px solid var(--neutral-100)',
                            cursor: 'grab',
                            backgroundColor: draggedIdx === idx ? 'var(--neutral-50)' : 'transparent',
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
                            {idx === 0 ? (
                              <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>NEXT</span>
                            ) : (
                              <span style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>STANDBY</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Leaderboard</h2>
              <button onClick={() => setLeaderboardIsFullscreen(true)} className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 12px', display: 'flex', gap: '6px', alignItems: 'center', background: 'var(--shiro)' }}>
                <Maximize size={14} /> View Fullscreen
              </button>
            </div>
            
            <div style={{ background: 'var(--shiro)', borderRadius: '16px', padding: '24px', border: '1px solid var(--neutral-200)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', background: 'var(--neutral-100)', borderRadius: '999px', padding: '4px', marginBottom: '24px' }}>
                <button onClick={() => setLeaderboardFilter('academy')} style={{ flex: 1, padding: '8px 12px', background: leaderboardFilter === 'academy' ? 'var(--shiro)' : 'transparent', borderRadius: '999px', border: leaderboardFilter === 'academy' ? '1px solid var(--neutral-200)' : 'none', fontSize: '11px', fontWeight: leaderboardFilter === 'academy' ? 800 : 700, color: leaderboardFilter === 'academy' ? 'var(--neutral-900)' : 'var(--neutral-500)', boxShadow: leaderboardFilter === 'academy' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>ACADEMY</button>
                <button onClick={() => setLeaderboardFilter('state')} style={{ flex: 1, padding: '8px 12px', background: leaderboardFilter === 'state' ? 'var(--shiro)' : 'transparent', borderRadius: '999px', border: leaderboardFilter === 'state' ? '1px solid var(--neutral-200)' : 'none', fontSize: '11px', fontWeight: leaderboardFilter === 'state' ? 800 : 700, color: leaderboardFilter === 'state' ? 'var(--neutral-900)' : 'var(--neutral-500)', boxShadow: leaderboardFilter === 'state' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>STATE</button>
                <button onClick={() => setLeaderboardFilter('country')} style={{ flex: 1, padding: '8px 12px', background: leaderboardFilter === 'country' ? 'var(--shiro)' : 'transparent', borderRadius: '999px', border: leaderboardFilter === 'country' ? '1px solid var(--neutral-200)' : 'none', fontSize: '11px', fontWeight: leaderboardFilter === 'country' ? 800 : 700, color: leaderboardFilter === 'country' ? 'var(--neutral-900)' : 'var(--neutral-500)', boxShadow: leaderboardFilter === 'country' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>COUNTRY</button>
              </div>
              
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '0.05em' }}>Top 3 {leaderboardFilter === 'academy' ? 'Academies' : leaderboardFilter === 'state' ? 'States' : 'Countries'} (Matches Won)</div>
              
              {leaderboard.length === 0 ? (
                <div style={{ color: 'var(--neutral-500)', fontSize: '13px' }}>No matches completed yet.</div>
              ) : (
                leaderboard.map((item, i) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: i < leaderboard.length - 1 ? '20px' : '0' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: i === 0 ? 'var(--aka)' : i === 1 ? 'rgba(225,29,72,0.1)' : 'rgba(26,77,181,0.1)', color: i === 0 ? 'white' : i === 1 ? 'var(--aka)' : 'var(--ao)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px' }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '2px' }}>{item.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--neutral-500)', fontWeight: 500 }}>{item.country}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, border: '1px solid var(--neutral-200)', padding: '4px 6px', borderRadius: '4px' }}>{item.wins} WINS</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div style={{ background: 'var(--neutral-50)', border: '1px dashed var(--neutral-300)', borderRadius: '16px', padding: '24px', marginTop: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>Recent Results ({activeCategoryName || 'No Active Category'})</div>
              
              {recentMatches.length === 0 ? (
                <div style={{ color: 'var(--neutral-500)', fontSize: '13px' }}>Category yet to begin</div>
              ) : (
                recentMatches.map((m, i) => {
                  const akaName = m.aka?.name || 'BYE';
                  const aoName = m.ao?.name || 'BYE';
                  const akaWon = m.winnerId === m.aka?.playerId || m.winnerId === m.aka?.name;
                  const aoWon = m.winnerId === m.ao?.playerId || m.winnerId === m.ao?.name;
                  
                  return (
                    <div key={m.id} style={{ fontSize: '13px', borderBottom: i < recentMatches.length - 1 ? '1px solid var(--neutral-200)' : 'none', paddingBottom: i < recentMatches.length - 1 ? '16px' : '0', marginBottom: i < recentMatches.length - 1 ? '16px' : '0' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginRight: '12px', color: 'var(--neutral-500)' }}>{m.matchNumber ? `M${String(m.matchNumber).padStart(2, '0')}` : m.id}</span> 
                      {akaWon ? (
                        <><span style={{ fontWeight: 700, color: 'var(--aka)' }}>{akaName}</span> def. {aoName}</>
                      ) : aoWon ? (
                        <><span style={{ fontWeight: 700, color: 'var(--ao)' }}>{aoName}</span> def. {akaName}</>
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

      {leaderboardIsFullscreen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--shiro)', zIndex: 10000, overflowY: 'auto', padding: '40px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
              <h1 style={{ fontSize: '40px', fontWeight: 800, margin: 0 }}>Tournament Leaderboard</h1>
              <button className="btn btn-secondary" onClick={() => setLeaderboardIsFullscreen(false)}>Close Fullscreen</button>
            </div>
            
            <div style={{ display: 'flex', background: 'var(--neutral-100)', borderRadius: '999px', padding: '4px', marginBottom: '40px', maxWidth: '400px' }}>
              <button onClick={() => setLeaderboardFilter('academy')} style={{ flex: 1, padding: '12px 24px', background: leaderboardFilter === 'academy' ? 'var(--shiro)' : 'transparent', borderRadius: '999px', border: leaderboardFilter === 'academy' ? '1px solid var(--neutral-200)' : 'none', fontSize: '13px', fontWeight: leaderboardFilter === 'academy' ? 800 : 700, color: leaderboardFilter === 'academy' ? 'var(--neutral-900)' : 'var(--neutral-500)', boxShadow: leaderboardFilter === 'academy' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>ACADEMY</button>
              <button onClick={() => setLeaderboardFilter('state')} style={{ flex: 1, padding: '12px 24px', background: leaderboardFilter === 'state' ? 'var(--shiro)' : 'transparent', borderRadius: '999px', border: leaderboardFilter === 'state' ? '1px solid var(--neutral-200)' : 'none', fontSize: '13px', fontWeight: leaderboardFilter === 'state' ? 800 : 700, color: leaderboardFilter === 'state' ? 'var(--neutral-900)' : 'var(--neutral-500)', boxShadow: leaderboardFilter === 'state' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>STATE</button>
              <button onClick={() => setLeaderboardFilter('country')} style={{ flex: 1, padding: '12px 24px', background: leaderboardFilter === 'country' ? 'var(--shiro)' : 'transparent', borderRadius: '999px', border: leaderboardFilter === 'country' ? '1px solid var(--neutral-200)' : 'none', fontSize: '13px', fontWeight: leaderboardFilter === 'country' ? 800 : 700, color: leaderboardFilter === 'country' ? 'var(--neutral-900)' : 'var(--neutral-500)', boxShadow: leaderboardFilter === 'country' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>COUNTRY</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {leaderboard.map((item, i) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '24px', background: 'var(--shiro)', border: '1px solid var(--neutral-200)', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: i === 0 ? 'var(--aka)' : i === 1 ? 'rgba(225,29,72,0.1)' : 'rgba(26,77,181,0.1)', color: i === 0 ? 'white' : i === 1 ? 'var(--aka)' : 'var(--ao)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '20px' }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '24px', marginBottom: '4px' }}>{item.name}</div>
                    <div style={{ fontSize: '14px', color: 'var(--neutral-500)', fontWeight: 500 }}>{item.country}</div>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--neutral-900)' }}>{item.wins} WINS</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal" style={{ background: 'var(--shiro)', width: '600px', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh', boxShadow: '0 24px 48px rgba(0,0,0,0.1)' }}>
            <div className="modal-header" style={{ padding: '24px', borderBottom: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Edit Full Match Queue</h3>
              <button className="close-btn" onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-500)' }}><span style={{fontSize:'20px'}}>×</span></button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
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
            <div className="modal-footer" style={{ padding: '24px', borderTop: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--neutral-50)' }}>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)} style={{ fontSize: '13px', fontWeight: 600 }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { setQueue(tempQueue); setShowEditModal(false); }} style={{ fontSize: '13px', fontWeight: 600 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PasswordGateway>
  );
}
