'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Maximize, ArrowLeft, Play, Pause, Flag, RotateCw, Coffee, Tv, ShieldAlert, ShieldCheck } from 'lucide-react';
import Header from '@/modules/core/layout/Header';
import PasswordGateway from '@/modules/auth/components/PasswordGateway';
import { toast } from 'react-hot-toast';
import KataOperatorPanel from '@/modules/kata/components/KataOperatorPanel';
import KataLiveScoreboard, { deriveJudgeVotes } from '@/modules/kata/components/KataLiveScoreboard';
import KumiteLiveScoreboard from '@/modules/kumite/components/KumiteLiveScoreboard';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import ScaleWrapper from '@/modules/shared/components/ScaleWrapper';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { KATA_LIST } from '@/lib/kata-list';
import { isMatSessionAuthorized } from '@/modules/auth/operator-auth';

function OperatorPortalInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const matIdParam = searchParams.get('mat') || 'mat-1';
  const matNumber = parseInt(matIdParam.replace(/\D/g, '') || '1', 10);
  const matNum = String(matNumber).padStart(2, '0');
  const matName = `MAT ${matNum}`;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const { user, role, loading: authLoading } = useAuth();
  const authKey = matIdParam ? `auth_${id}_${matIdParam}` : `auth_${id}`;
  const [verified, setVerified] = useState(() => {
    if (typeof window !== 'undefined') {
      return isMatSessionAuthorized(id, matIdParam, (k) => sessionStorage.getItem(k));
    }
    return false;
  });
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const isViewer = role === 'guest_viewer' || (!staffRole && role !== 'admin');
  const isAdmin = role === 'admin';

  // Admin Override & TV Scoreboard states
  const [adminOverride, setAdminOverride] = useState<{
    active: boolean;
    adminName?: string;
    adminUid?: string | null;
    timestamp?: number;
  } | null>(null);
  const isOverriddenByAdmin = Boolean(adminOverride?.active && !isAdmin);
  const [isTvConnected, setIsTvConnected] = useState(false);
  const bcRef = useRef<BroadcastChannel | null>(null);

  // Live Staff Reassignment state
  const [reassignmentNotice, setReassignmentNotice] = useState<{
    active: boolean;
    toMatId: string;
    toMatName: string;
    fromMatName: string;
    countdown: number;
  } | null>(null);

  const playTransferChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // AudioContext may be restricted by browser autoplay policy
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const hasPasswordAuth = isMatSessionAuthorized(id, matIdParam, (k) => sessionStorage.getItem(k));

    if (hasPasswordAuth || role === 'admin' || role === 'mat_operator') {
      setVerified(true);
    }
    
    if (!user) {
      if (hasPasswordAuth || role === 'admin' || role === 'mat_operator') {
        setVerified(true);
      }
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let verifyTimeout = setTimeout(() => {
      setVerified(true);
    }, 2500);
    
    const checkStaff = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { collection, query, where, getDocs, doc, onSnapshot } = await import('firebase/firestore');
        
        // 1. Check if matched by UID
        let q = query(collection(db, 'competitions', id, 'staff'), where('userId', '==', user.uid));
        let snap = await getDocs(q);
        
        if (snap.empty && user.email) {
          // 2. Check if matched by email
          q = query(collection(db, 'competitions', id, 'staff'), where('email', '==', user.email));
          snap = await getDocs(q);
        }

        if (snap.empty) {
          clearTimeout(verifyTimeout);
          if (role === 'admin' || hasPasswordAuth) {
            setVerified(true);
            return;
          }
          // Not registered in roster
          window.location.href = `/login?compId=${id}`;
          return;
        }
        
        const staffDoc = snap.docs[0];
        const staffDocId = staffDoc.id;

        // Set up real-time listener for this staff member doc
        unsubscribe = onSnapshot(doc(db, 'competitions', id, 'staff', staffDocId), (docSnap) => {
          if (!docSnap.exists()) return;
          const staffData = docSnap.data();
          
          if (staffData.approvalStatus === 'approved') {
            setStaffRole(staffData.role);
            setVerified(true);

            // Check live mat assignment (only for dedicated mat operators)
            const currentMatNum = parseInt(matIdParam.replace(/\D/g, '') || '1', 10);
            const targetMat = staffData.reassignedToMat || (staffData.assignedMats && staffData.assignedMats.length > 0 ? staffData.assignedMats[0] : null);
            const isOperatorStaff = staffData.role === 'score' || role === 'mat_operator';
            
            if (isOperatorStaff && targetMat) {
              const targetMatNum = parseInt(targetMat.replace(/\D/g, '') || '1', 10);
              const targetMatId = `mat-${targetMatNum}`;
              const targetMatName = staffData.reassignedToMatName || `MAT ${String(targetMatNum).padStart(2, '0')}`;
              
              if (currentMatNum !== targetMatNum) {
                // Trigger 5-second countdown transfer modal
                setReassignmentNotice(prev => {
                  if (prev?.active && prev.toMatId === targetMatId) return prev;
                  toast.success(`You are assigned to ${targetMatName}! Transferring...`, { duration: 5000, icon: '🔄' });
                  playTransferChime();
                  return {
                    active: true,
                    toMatId: targetMatId,
                    toMatName: targetMatName,
                    fromMatName: matName,
                    countdown: 5,
                  };
                });
              }
            }
          } else if (role !== 'admin') {
            // Go to pending approval
            window.location.href = `/login/pending?compId=${id}&staffId=${staffDocId}`;
          }
        });
      } catch (err) {
        console.error('Error verifying staff assignment:', err);
        setVerified(true); // Fallback to not lock operator out in case of errors
      }
    };
    
    checkStaff();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, role, authLoading, id, matIdParam, matName, playTransferChime]);

  // Countdown timer for live reassignment transfer
  useEffect(() => {
    if (!reassignmentNotice?.active) return;
    
    // Stop any active match running on current mat
    setRunning(false);

    if (reassignmentNotice.countdown <= 0) {
      window.location.href = `/competitions/${id}/operator?mat=${reassignmentNotice.toMatId}`;
      return;
    }

    const timer = setInterval(() => {
      setReassignmentNotice(prev => {
        if (!prev) return null;
        if (prev.countdown <= 1) {
          window.location.href = `/competitions/${id}/operator?mat=${prev.toMatId}`;
          return { ...prev, countdown: 0 };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [reassignmentNotice, id]);

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

  const [kataVotes, setKataVotes] = useState<{ aka: number, ao: number } | null>(null);
  const [kataWinner, setKataWinner] = useState<string | null>(null);
  const [kataScores, setKataScores] = useState<any>(null);
  const [selectedKata, setSelectedKata] = useState<any>(null);
  const [revealVotes, setRevealVotes] = useState(false);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [restRunning, setRestRunning] = useState(false);

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
  const hasHydratedRef = useRef(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [tempQueue, setTempQueue] = useState<any[]>([]);
  const [winnerState, setWinnerState] = useState<{ color: 'aka'|'ao', name: string, academy: string, points: number } | null>(null);
  
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [queueFilterPool, setQueueFilterPool] = useState('1');
  
  useEffect(() => {
    const keys = Object.keys(poolStatuses);
    if (keys.length > 0 && !keys.includes(queueFilterPool)) {
      const sortedKeys = keys.sort((a,b) => {
        if (a === 'finals') return 1;
        if (b === 'finals') return -1;
        return parseInt(a) - parseInt(b);
      });
      setQueueFilterPool(sortedKeys[0]);
    }
  }, [poolStatuses]);
  
  const filteredQueue = React.useMemo(() => queue.filter(match => {
    let matchFullName = `${match.aka} ${match.ao}`.toLowerCase();
    let matchesSearch = queueSearchQuery ? matchFullName.includes(queueSearchQuery.toLowerCase()) : true;
    let matchesCat = activeCategoryName ? match.category === activeCategoryName : true;
    let matchesPool = queueFilterPool ? String(match.pool) === queueFilterPool : true;
    return matchesSearch && matchesCat && matchesPool;
  }), [queue, queueSearchQuery, activeCategoryName, queueFilterPool]);
  
  const visibleQueue = filteredQueue;
  
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // No leaderboard needed — replaced by Skipped Categories panel

  // Cache firebase refs so we don't re-import on every tick
  const rtdbRefCache = useRef<any>(null);
  const rtdbSetCache = useRef<any>(null);
  const rtdbDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // RTDB sync — debounced to max 1 write per 500ms to avoid write storms during timer ticks
  const syncRTDB = useCallback(async (payload: any) => {
    if (isViewer || isOverriddenByAdmin) return;
    try {
      if (!rtdbRefCache.current || !rtdbSetCache.current) {
        const { rtdb } = await import('@lib/firebase');
        const { ref, update } = await import('firebase/database');
        rtdbRefCache.current = ref(rtdb, `live_scores/${id}/mats/${matIdParam}`);
        rtdbSetCache.current = update;
      }
      await rtdbSetCache.current(rtdbRefCache.current, payload);
    } catch (err) {
      console.error('Failed to sync RTDB', err);
    }
  }, [id, isViewer, isOverriddenByAdmin, matIdParam]);

  const isKata = activeCategoryData?.isKata || activeCategoryName?.toLowerCase().includes('kata');

  // Broadcast current state to TV Scoreboard (via BroadcastChannel)
  const broadcastCurrentState = useCallback(() => {
    if (!bcRef.current) return;
    try {
      const mm = Math.floor(timer / 60).toString().padStart(2, '0');
      const ss = (timer % 60).toString().padStart(2, '0');
      const isKataMatch = activeCategoryName?.toLowerCase().includes('kata') || false;
      bcRef.current.postMessage({
        type: 'STATE_UPDATE',
        payload: {
          status: status === 'finished' ? 'standby' : (status === 'upcoming' ? 'upcoming' : (running ? 'live' : 'paused')),
          matchStatus: status === 'finished' ? 'COMPLETED' : (running ? 'LIVE' : (status === 'upcoming' ? 'UPCOMING' : 'PAUSED')),
          currentCategory: activeCategoryName || 'No Active Category',
          isKata: isKataMatch,
          numberOfJudges: activeCategoryData?.numberOfJudges || 3,
          currentMatch: queue[0]?.displayId || 'Standby',
          matchDisplayId: queue[0]?.displayId || 'Standby',
          matchId: activeMatchId || queue[0]?.id || null,
          akaName: aka.name, akaCountry: aka.country, akaAcademy: aka.academy,
          aoName: ao.name, aoCountry: ao.country, aoAcademy: ao.academy,
          scores: { aka: aka.score, ao: ao.score },
          akaStats: { yuko: aka.yuko, waza: aka.waza, ippon: aka.ippon, senshu: aka.senshu },
          aoStats: { yuko: ao.yuko, waza: ao.waza, ippon: ao.ippon, senshu: ao.senshu },
          akaPenalties: { c1: aka.c1, c2: aka.c2, c3: aka.c3, hc: aka.hc, h: aka.h },
          aoPenalties:  { c1: ao.c1,  c2: ao.c2,  c3: ao.c3,  hc: ao.hc,  h: ao.h  },
          restTimerSeconds: restTimer, restTimerRunning: restRunning,
          timeRemaining: `${mm}:${ss}`,
          timerSeconds: timer,
          timerRunning: running,
          selectedKata,
          kataVotes,
          kataWinner,
          kataScores,
          revealVotes,
          revealCountdown,
          adminOverride,
          winnerName: winnerState?.name || null,
          winnerColor: winnerState?.color || null,
          winnerAcademy: winnerState?.academy || null,
          winnerPoints: winnerState?.points ?? null,
          nextMatch: queue[0] ? {
            matchId: queue[0].displayId || queue[0].id,
            aka: queue[0].aka,
            ao: queue[0].ao,
            akaAcademy: queue[0].akaAcademy,
            aoAcademy: queue[0].aoAcademy,
            category: queue[0].category,
            akaReady: queue[0].akaReady,
            aoReady: queue[0].aoReady,
          } : null,
        }
      });
    } catch (e) {
      console.warn('Broadcast error:', e);
    }
  }, [timer, activeCategoryName, status, running, activeCategoryData, queue, activeMatchId, aka, ao, restTimer, restRunning, selectedKata, kataVotes, kataWinner, kataScores, revealVotes, revealCountdown, adminOverride, winnerState]);

  // Native BroadcastChannel: 0 ms latency local cross-tab / cross-window sync
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      const channelName = `taikaix_scoreboard_${id}_${matIdParam}`;
      bc = new BroadcastChannel(channelName);
      bcRef.current = bc;

      bc.onmessage = (event) => {
        if (event.data?.type === 'SCOREBOARD_MOUNTED') {
          setIsTvConnected(true);
          broadcastCurrentState();
        }
      };
    } catch (err) {
      console.warn('BroadcastChannel error in operator:', err);
    }

    return () => {
      if (bc) bc.close();
      bcRef.current = null;
    };
  }, [id, matIdParam, broadcastCurrentState]);

  // State sync effect: broadcasts immediately to local TV scoreboard (<1ms) and debounces RTDB
  useEffect(() => {
    const mm = Math.floor(timer / 60).toString().padStart(2, '0');
    const ss = (timer % 60).toString().padStart(2, '0');
    const isKataMatch = activeCategoryName?.toLowerCase().includes('kata') || false;
    const payload: any = {
      status: status === 'finished' ? 'standby' : (status === 'upcoming' ? 'upcoming' : (running ? 'live' : 'paused')),
      matchStatus: status === 'finished' ? 'COMPLETED' : (running ? 'LIVE' : (status === 'upcoming' ? 'UPCOMING' : 'PAUSED')),
      currentCategory: activeCategoryName || 'No Active Category',
      isKata: isKataMatch,
      numberOfJudges: activeCategoryData?.numberOfJudges || 3,
      currentMatch: queue[0]?.displayId || 'Standby',
      matchDisplayId: queue[0]?.displayId || 'Standby',
      matchId: activeMatchId || queue[0]?.id || null,
      akaName: aka.name, akaCountry: aka.country, akaAcademy: aka.academy,
      aoName: ao.name, aoCountry: ao.country, aoAcademy: ao.academy,
      scores: { aka: aka.score, ao: ao.score },
      akaStats: { yuko: aka.yuko, waza: aka.waza, ippon: aka.ippon, senshu: aka.senshu },
      aoStats: { yuko: ao.yuko, waza: ao.waza, ippon: ao.ippon, senshu: ao.senshu },
      akaPenalties: { c1: aka.c1, c2: aka.c2, c3: aka.c3, hc: aka.hc, h: aka.h },
      aoPenalties:  { c1: ao.c1,  c2: ao.c2,  c3: ao.c3,  hc: ao.hc,  h: ao.h  },
      restTimerSeconds: restTimer, restTimerRunning: restRunning,
      timeRemaining: `${mm}:${ss}`,
      timerSeconds: timer,
      timerRunning: running,
      selectedKata,
      kataVotes,
      kataWinner,
      kataScores,
      revealVotes,
      revealCountdown,
      adminOverride,
      winnerName: winnerState?.name || null,
      winnerColor: winnerState?.color || null,
      winnerAcademy: winnerState?.academy || null,
      winnerPoints: winnerState?.points ?? null,
      nextMatch: queue[0] ? {
        matchId: queue[0].displayId || queue[0].id,
        aka: queue[0].aka,
        ao: queue[0].ao,
        akaAcademy: queue[0].akaAcademy,
        aoAcademy: queue[0].aoAcademy,
        category: queue[0].category,
        akaReady: queue[0].akaReady,
        aoReady: queue[0].aoReady,
      } : null,
    };

    if (!isKataMatch) {
      payload.timerSeconds = timer;
      payload.timerRunning = running;
      payload.timeRemaining = `${mm}:${ss}`;
    }

    // 1. Instant local broadcast to Scoreboard (< 1 ms latency)
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({
          type: 'STATE_UPDATE',
          payload
        });
      } catch (err) {
        console.warn('BroadcastChannel post error:', err);
      }
    }

    // 2. Cloud RTDB sync (skip if viewer, overridden by admin, or not yet hydrated)
    if (!isViewer && !isOverriddenByAdmin && hasHydratedRef.current) {
      if (rtdbDebounceTimer.current) clearTimeout(rtdbDebounceTimer.current);
      rtdbDebounceTimer.current = setTimeout(() => syncRTDB(payload), 500);
    }

    return () => {
      if (rtdbDebounceTimer.current) clearTimeout(rtdbDebounceTimer.current);
    };
  }, [id, aka, ao, timer, status, running, activeCategoryName, queue, syncRTDB, isViewer, isOverriddenByAdmin, activeMatchId, activeCategoryData, restTimer, restRunning, selectedKata, kataVotes, kataWinner, kataScores, revealVotes, revealCountdown, adminOverride, winnerState]);

  // Unified RTDB Listener: Syncs Admin Override, Viewer/Overridden mirror mode, and Kata events
  useEffect(() => {
    let unsubscribe = () => {};
    const setupListener = async () => {
      const { rtdb } = await import('@lib/firebase');
      const { ref, onValue, off } = await import('firebase/database');
      const liveRef = ref(rtdb, `live_scores/${id}/mats/${matIdParam}`);
      
      onValue(liveRef, (snapshot) => {
        const val = snapshot.val();
        if (!val) {
          hasHydratedRef.current = true;
          return;
        }

        // 1. Always sync admin override status
        setAdminOverride(val.adminOverride || null);

        const currentIsAdmin = role === 'admin';
        const isOverridden = Boolean(val.adminOverride?.active && !currentIsAdmin);

        // 2. If viewer OR overridden by admin, mirror the entire live score from RTDB
        if (isViewer || isOverridden) {
          setAka(prev => ({
            ...prev,
            name: val.akaName || prev.name,
            country: val.akaCountry || prev.country,
            academy: val.akaAcademy || prev.academy,
            score: val.scores?.aka ?? prev.score,
            yuko: val.akaStats?.yuko ?? prev.yuko,
            waza: val.akaStats?.waza ?? prev.waza,
            ippon: val.akaStats?.ippon ?? prev.ippon,
            senshu: val.akaStats?.senshu ?? prev.senshu,
            c1: val.akaPenalties?.c1 ?? prev.c1,
            c2: val.akaPenalties?.c2 ?? prev.c2,
            c3: val.akaPenalties?.c3 ?? prev.c3,
            hc: val.akaPenalties?.hc ?? prev.hc,
            h: val.akaPenalties?.h ?? prev.h,
          }));
          setAo(prev => ({
            ...prev,
            name: val.aoName || prev.name,
            country: val.aoCountry || prev.country,
            academy: val.aoAcademy || prev.academy,
            score: val.scores?.ao ?? prev.score,
            yuko: val.aoStats?.yuko ?? prev.yuko,
            waza: val.aoStats?.waza ?? prev.waza,
            ippon: val.aoStats?.ippon ?? prev.ippon,
            senshu: val.aoStats?.senshu ?? prev.senshu,
            c1: val.aoPenalties?.c1 ?? prev.c1,
            c2: val.aoPenalties?.c2 ?? prev.c2,
            c3: val.aoPenalties?.c3 ?? prev.c3,
            hc: val.aoPenalties?.hc ?? prev.hc,
            h: val.aoPenalties?.h ?? prev.h,
          }));
          setStatus(val.status || 'ongoing');
          if (val.currentCategory) setActiveCategoryName(val.currentCategory);
          if (val.matchId) setActiveMatchId(val.matchId);
          setKataVotes(val.kataVotes || null);
          setKataWinner(val.kataWinner || null);
          setKataScores(val.kataScores || null);
          setSelectedKata(val.selectedKata || null);
          setRevealVotes(val.revealVotes || false);
          setRevealCountdown(val.revealCountdown || 0);
          if (val.timeRemaining) {
            const [mm, ss] = val.timeRemaining.split(':').map(Number);
            if (!isNaN(mm) && !isNaN(ss)) setTimer(mm * 60 + ss);
          }
          setRunning(val.timerRunning || false);
        } else if (!hasHydratedRef.current) {
          // 3. First arrival of live RTDB state for active operator: hydrate state so leaving/returning preserves match
          hasHydratedRef.current = true;
          if (val.matchId) {
            setActiveMatchId(val.matchId);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(`activeMatch_${matIdParam}`, val.matchId);
            }
          }
          if (val.akaName || val.scores?.aka !== undefined) {
            setAka(prev => ({
              ...prev,
              name: val.akaName || prev.name,
              country: val.akaCountry || prev.country,
              academy: val.akaAcademy || prev.academy,
              score: val.scores?.aka ?? prev.score,
              yuko: val.akaStats?.yuko ?? prev.yuko,
              waza: val.akaStats?.waza ?? prev.waza,
              ippon: val.akaStats?.ippon ?? prev.ippon,
              senshu: val.akaStats?.senshu ?? prev.senshu,
              c1: val.akaPenalties?.c1 ?? prev.c1,
              c2: val.akaPenalties?.c2 ?? prev.c2,
              c3: val.akaPenalties?.c3 ?? prev.c3,
              hc: val.akaPenalties?.hc ?? prev.hc,
              h: val.akaPenalties?.h ?? prev.h,
            }));
          }
          if (val.aoName || val.scores?.ao !== undefined) {
            setAo(prev => ({
              ...prev,
              name: val.aoName || prev.name,
              country: val.aoCountry || prev.country,
              academy: val.aoAcademy || prev.academy,
              score: val.scores?.ao ?? prev.score,
              yuko: val.aoStats?.yuko ?? prev.yuko,
              waza: val.aoStats?.waza ?? prev.waza,
              ippon: val.aoStats?.ippon ?? prev.ippon,
              senshu: val.aoStats?.senshu ?? prev.senshu,
              c1: val.aoPenalties?.c1 ?? prev.c1,
              c2: val.aoPenalties?.c2 ?? prev.c2,
              c3: val.aoPenalties?.c3 ?? prev.c3,
              hc: val.aoPenalties?.hc ?? prev.hc,
              h: val.aoPenalties?.h ?? prev.h,
            }));
          }
          if (val.status && val.status !== 'finished') setStatus(val.status);
          if (val.currentCategory) setActiveCategoryName(val.currentCategory);
          if (val.kataVotes !== undefined) setKataVotes(val.kataVotes || null);
          if (val.kataWinner !== undefined) setKataWinner(val.kataWinner || null);
          if (val.kataScores !== undefined) setKataScores(val.kataScores || null);
          if (val.selectedKata !== undefined) setSelectedKata(val.selectedKata || null);
          if (val.revealVotes !== undefined) setRevealVotes(val.revealVotes || false);
          if (val.revealCountdown !== undefined) setRevealCountdown(val.revealCountdown || 0);
          if (val.timeRemaining) {
            const [mm, ss] = val.timeRemaining.split(':').map(Number);
            if (!isNaN(mm) && !isNaN(ss)) setTimer(mm * 60 + ss);
          } else if (val.timerSeconds !== undefined) {
            setTimer(val.timerSeconds);
          }
          if (val.timerRunning !== undefined) setRunning(val.timerRunning);
          if (val.restTimerSeconds !== undefined) setRestTimer(val.restTimerSeconds);
          if (val.restTimerRunning !== undefined) setRestRunning(val.restTimerRunning);
        } else {
          // 4. Normal active operator runtime updates — sync Kata updates from remote judges / panel
          if (val.kataVotes !== undefined) setKataVotes(val.kataVotes || null);
          if (val.kataWinner !== undefined) setKataWinner(val.kataWinner || null);
          if (val.kataScores !== undefined) setKataScores(val.kataScores || null);
          if (val.selectedKata !== undefined) setSelectedKata(val.selectedKata || null);
          if (val.revealVotes !== undefined) setRevealVotes(val.revealVotes || false);
          if (val.revealCountdown !== undefined) setRevealCountdown(val.revealCountdown || 0);
        }
      });
      unsubscribe = () => off(liveRef);
    };
    setupListener();
    return () => unsubscribe();
  }, [id, isViewer, role, matIdParam]);

  // Admin Override Toggle Handler (Exclusive to Admin)
  const handleToggleAdminOverride = useCallback(async () => {
    if (role !== 'admin') {
      toast.error('Only administrators can take direct control of mat scoreboards.');
      return;
    }

    try {
      const { rtdb } = await import('@lib/firebase');
      const { ref, update, get } = await import('firebase/database');
      const liveRef = ref(rtdb, `live_scores/${id}/mats/${matIdParam}`);

      const currentlyActive = Boolean(adminOverride?.active);
      const newActive = !currentlyActive;

      const overrideData = {
        adminOverride: {
          active: newActive,
          adminName: user?.displayName || user?.email?.split('@')[0] || 'Tournament Director',
          adminUid: newActive ? (user?.uid || 'admin') : null,
          timestamp: Date.now(),
        }
      };

      await update(liveRef, overrideData);
      setAdminOverride(overrideData.adminOverride);

      if (newActive) {
        // Hydrate from existing RTDB so admin starts seamlessly with current match state
        const snap = await get(liveRef);
        const val = snap.val();
        if (val) {
          if (val.akaName) setAka(prev => ({ ...prev, name: val.akaName, country: val.akaCountry || '', academy: val.akaAcademy || '', score: val.scores?.aka ?? prev.score }));
          if (val.aoName) setAo(prev => ({ ...prev, name: val.aoName, country: val.aoCountry || '', academy: val.aoAcademy || '', score: val.scores?.ao ?? prev.score }));
          if (val.currentCategory) setActiveCategoryName(val.currentCategory);
          if (val.matchId) setActiveMatchId(val.matchId);
          if (val.timeRemaining) {
            const [mm, ss] = val.timeRemaining.split(':').map(Number);
            if (!isNaN(mm) && !isNaN(ss)) setTimer(mm * 60 + ss);
          }
        }
        toast.success(`You have taken direct control of Mat ${matNum}. Operator controls are locked.`, {
          icon: '🛡️',
          duration: 4000,
        });
      } else {
        toast.success('Mat control released. Operator controls restored.', {
          icon: '✅',
          duration: 3000,
        });
      }
    } catch (err) {
      console.error('Failed to update admin override:', err);
      toast.error('Failed to change mat control state.');
    }
  }, [id, role, user, adminOverride, matIdParam, matNum]);

  // Launch Dedicated TV Scoreboard on Secondary Monitor
  const handleLaunchTVScoreboard = useCallback(async () => {
    const targetUrl = `/competitions/${id}/scoreboard?mat=${matIdParam}&auto=1`;

    // 1. Modern Chromium Multi-Screen Window Management API
    if (typeof window !== 'undefined' && 'getScreenDetails' in window) {
      try {
        const screenDetails = await (window as any).getScreenDetails();
        const secondaryScreen = screenDetails.screens.find((s: any) => !s.isPrimary) || (screenDetails.screens.length > 1 ? screenDetails.screens[1] : null);

        if (secondaryScreen) {
          const windowFeatures = [
            `left=${secondaryScreen.availLeft}`,
            `top=${secondaryScreen.availTop}`,
            `width=${secondaryScreen.availWidth}`,
            `height=${secondaryScreen.availHeight}`,
            'menubar=no',
            'toolbar=no',
            'location=no',
            'status=no',
            'resizable=yes',
            'scrollbars=no',
            'popup=yes'
          ].join(',');

          const tvWin = window.open(targetUrl, `taikaix_scoreboard_${matIdParam}`, windowFeatures);
          if (tvWin) {
            toast.success(`Scoreboard opened on secondary display (${secondaryScreen.label || 'Screen 2'})!`, { icon: '📺' });
            return;
          }
        }
      } catch (err) {
        console.log('Window Management API not permitted or skipped:', err);
      }
    }

    // 2. Fallback popup window positioned on secondary display or new tab
    const screenLeftOffset = typeof window !== 'undefined' ? (window.screen.availWidth || 1920) : 1920;
    const fallbackFeatures = `left=${screenLeftOffset},top=0,width=1920,height=1080,popup=yes,resizable=yes`;
    const popup = window.open(targetUrl, `taikaix_scoreboard_${matIdParam}`, fallbackFeatures);

    if (popup) {
      toast.success('Scoreboard window opened! Press F on the scoreboard to enter fullscreen.', { icon: '📺' });
    } else {
      window.open(targetUrl, '_blank');
      toast.success('Scoreboard opened in a new tab. Press F to enter fullscreen.', { icon: '📺' });
    }
  }, [id, matIdParam]);

  useEffect(() => {
    let unsubscribe = () => {};
    const setupQueue = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, doc, getDoc } = await import('firebase/firestore');

      // Clear previous mat state immediately on mat switch
      hasHydratedRef.current = false;
      setActiveMatchId(null);
      activeCategoryRef.current = null;
      setActiveCategoryId(null);
      setActiveCategoryName('');
      setActiveCategoryData(null);
      setQueue([]);
      setRecentMatches([]);
      setSkippedCategories([]);
      setPoolStatuses({});
      setAka({ name: 'AKA', country: '', academy: '', score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: '' });
      setAo({ name: 'AO', country: '', academy: '', score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: '' });
      setStatus('upcoming');
      setRunning(false);
      setTimer(180);
      rtdbRefCache.current = null;

      const compRef = doc(db, 'competitions', id);
      const compSnap = await getDoc(compRef);
      if (compSnap.exists()) {
        setCompData(compSnap.data());
      }

      const catsCollection = collection(db, 'competitions', id, 'categories');

      unsubscribe = onSnapshot(catsCollection, (snap) => {
        // Robust mat matching: extracts any digits from category.mat (e.g. 'MAT 03', 'mat-3', 'Mat 3', 3)
        const allCats = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const matCats = allCats.filter(c => {
          const catMatNum = parseInt(String(c.mat || '').replace(/\D/g, ''), 10);
          return catMatNum === matNumber;
        });

        let cats = matCats.filter(c => (c.athletes?.length ?? c.entries ?? 0) > 0);
        
        let completed: any[] = [];
        cats.forEach(cat => {
          (cat.matches || []).forEach((m: any) => {
            if (m.status === 'completed' && m.winnerId) {
              completed.push(m);
            }
          });
        });
        setAllCompletedMatches(completed);

        // Extract skipped categories for this mat for the sidebar
        const skipped = matCats.filter((c: any) => c.status === 'skipped');
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
            pool: m.pool || (m.id && m.id.includes('Pool') ? m.id.split('-')[0].replace('Pool', '') : (m.id && m.id.includes('finals') ? 'finals' : '1')),
            akaReady: m.aka?.readiness === 'ready',
            aoReady: m.ao?.readiness === 'ready',
          })).filter((m: any) => !m.aka.startsWith('Winner M') && !m.ao.startsWith('Winner M'));
          setQueue(mappedQueue);

          // Automatically select best match if none is active or active is not in mappedQueue
          if (mappedQueue.length > 0) {
            setActiveMatchId(prevActiveId => {
              if (prevActiveId && mappedQueue.some((m: any) => m.id === prevActiveId)) {
                return prevActiveId;
              }
              const stored = typeof window !== 'undefined' ? sessionStorage.getItem(`activeMatch_${matIdParam}`) : null;
              if (stored && mappedQueue.some((m: any) => m.id === stored)) {
                const matched = mappedQueue.find((m: any) => m.id === stored);
                if (matched) {
                  if (!hasHydratedRef.current) {
                    setAka({ name: matched.aka, country: matched.akaCountry, academy: matched.akaAcademy, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: matched.akaId });
                    setAo({ name: matched.ao, country: matched.aoCountry, academy: matched.aoAcademy, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: matched.aoId });
                    const isKata = activeCat.isKata || activeCat.name?.toLowerCase().includes('kata') || false;
                    setTimer(isKata ? 0 : matchDuration);
                    setStatus('upcoming');
                    setWinnerState(null);
                  }
                  return matched.id;
                }
              }
              const candidate = mappedQueue.find((m: any) => m.akaReady && m.aoReady)
                || mappedQueue.find((m: any) => m.akaReady || m.aoReady)
                || mappedQueue[0];

              if (candidate) {
                if (!hasHydratedRef.current) {
                  setAka({ name: candidate.aka, country: candidate.akaCountry, academy: candidate.akaAcademy, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: candidate.akaId });
                  setAo({ name: candidate.ao, country: candidate.aoCountry, academy: candidate.aoAcademy, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: candidate.aoId });
                  const isKata = activeCat.isKata || activeCat.name?.toLowerCase().includes('kata') || false;
                  setTimer(isKata ? 0 : matchDuration);
                  setStatus('upcoming');
                  setWinnerState(null);
                }
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem(`activeMatch_${matIdParam}`, candidate.id);
                }
                return candidate.id;
              }
              return null;
            });
          }
          
          const poolStats: Record<string, { total: number, completed: number }> = {};
          matches.forEach((m: any) => {
            const p = m.pool || (m.id && m.id.includes('Pool') ? m.id.split('-')[0].replace('Pool', '') : (m.id && m.id.includes('finals') ? 'finals' : '1'));
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
  }, [id, matIdParam, matNumber]);
  const loadMatch = (m: any, isHydrating = false) => {
    if (!isHydrating && isOverriddenByAdmin) {
      toast.error('Cannot change match while Admin override is active.');
      return;
    }
    setActiveMatchId(m.id);
    if (!isHydrating) {
      setAka({ name: m.aka, country: m.akaCountry, academy: m.akaAcademy, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: m.akaId });
      setAo({ name: m.ao, country: m.aoCountry, academy: m.aoAcademy, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false, id: m.aoId });
      
      const isKataMatch = m.category?.toLowerCase().includes('kata') || activeCategoryData?.isKata || activeCategoryName?.toLowerCase().includes('kata') || false;
      
      setTimer(isKataMatch ? 0 : matchDuration);
      setStatus('upcoming');

      setWinnerState(null);
    } else {
      setAka(p => ({ ...p, name: m.aka, country: m.akaCountry, academy: m.akaAcademy, id: m.akaId }));
      setAo(p => ({ ...p, name: m.ao, country: m.aoCountry, academy: m.aoAcademy, id: m.aoId }));
    }

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
          timer: isKataMatch ? 0 : matchDuration,
          running: false,
          status: 'upcoming',

          isKata: !!isKataMatch,
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

  const [prevQueue, setPrevQueue] = useState(queue);
  if (queue !== prevQueue) {
    setPrevQueue(queue);
    if (activeMatchId) {
       const m = queue.find(q => q.id === activeMatchId);
       if (m) {
         setAka(p => ({ ...p, name: m.aka, country: m.akaCountry, academy: m.akaAcademy }));
         setAo(p => ({ ...p, name: m.ao, country: m.aoCountry, academy: m.aoAcademy }));
       }
    }
  }

  useEffect(() => {
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
                          setStatus(d.status);
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
    }
  }, [queue, activeMatchId, id, isViewer, matIdParam]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const saveQueueToFirestore = async (newQueue: any[]) => {
    if (!activeCategoryId || !activeCategoryData) return;
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@lib/firebase');
      
      const originalMatches = activeCategoryData.matches || [];
      const newMatches = [...originalMatches];
      
      const indicesToReplace: number[] = [];
      originalMatches.forEach((m: any, idx: number) => {
        if (newQueue.some((qItem: any) => qItem.id === m.id)) {
          indicesToReplace.push(idx);
        }
      });
      
      indicesToReplace.sort((a, b) => a - b);
      
      indicesToReplace.forEach((originalIdx, queueIdx) => {
        const queueMatch = newQueue[queueIdx];
        if (queueMatch) {
          const originalMatchObj = originalMatches.find((m: any) => m.id === queueMatch.id);
          if (originalMatchObj) {
            newMatches[originalIdx] = originalMatchObj;
          }
        }
      });
      
      const catRef = doc(db, 'competitions', id, 'categories', activeCategoryId);
      await updateDoc(catRef, { matches: newMatches });
      toast.success('Queue order updated in database!');
    } catch (err) {
      console.error('Error saving queue order:', err);
      toast.error('Failed to save queue order.');
    }
  };

  const handleDropQueue = async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    
    const newVisibleQueue = [...visibleQueue];
    const [draggedItem] = newVisibleQueue.splice(draggedIdx, 1);
    newVisibleQueue.splice(targetIdx, 0, draggedItem);
    
    const newQueue = [...queue];
    const indicesToReplace: number[] = [];
    queue.forEach((m, qIdx) => {
      if (visibleQueue.some(vq => vq.id === m.id)) {
        indicesToReplace.push(qIdx);
      }
    });
    
    indicesToReplace.forEach((qIdx, vIdx) => {
      newQueue[qIdx] = newVisibleQueue[vIdx];
    });
    
    setQueue(newQueue);
    setDraggedIdx(null);
    
    await saveQueueToFirestore(newQueue);
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
    const isKataMatch = activeCategoryData?.isKata || activeCategoryName?.toLowerCase().includes('kata');
    let interval: NodeJS.Timeout;
    if (running) {
      if (isKataMatch) {
        interval = setInterval(() => setTimer(t => t + 1), 1000);
      } else {
        if (timer > 0) {
          interval = setInterval(() => setTimer(t => t - 1), 1000);
        } else if (timer === 0) {
          setRunning(false);
        }
      }
    }
    return () => clearInterval(interval);
  }, [running, timer, activeCategoryData, activeCategoryName]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (restRunning && restTimer > 0) {
      interval = setInterval(() => setRestTimer(t => t - 1), 1000);
    } else if (restTimer === 0 && restRunning) {
      setRestRunning(false);
    }
    return () => clearInterval(interval);
  }, [restRunning, restTimer]);

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
    if (isOverriddenByAdmin) {
      toast.error('Controls are locked while Admin override is active.');
      return;
    }
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
    if (isOverriddenByAdmin) {
      toast.error('Controls are locked while Admin override is active.');
      return;
    }
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
    if (isOverriddenByAdmin) {
      toast.error('Controls are locked while Admin override is active.');
      return;
    }
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

  // Kata match finished (called from KataOperatorPanel)
  const handleKataMatchFinished = async (winner: 'aka' | 'ao', votes: { aka: number; ao: number }, kataSelectionUsed?: any) => {
    const currentMatch = queue.find(m => m.id === activeMatchId);
    if (!currentMatch || !activeCategoryId) {
      toast.error('No active match to finish');
      return;
    }
    setRunning(false);
    setStatus('finished');
    const realWinnerId = winner === 'aka' ? currentMatch?.akaId : currentMatch?.aoId;
    const winnerName = winner === 'aka' ? aka.name : ao.name;
    const winnerAcademy = winner === 'aka' ? aka.academy : ao.academy;

    setWinnerState({ color: winner, name: winnerName, academy: winnerAcademy, points: 0 });
    setKataWinner(winner);
    setKataVotes(votes);

    if (currentMatch) {
      setRecentMatches(prev => [{ ...currentMatch, status: 'completed', winnerId: realWinnerId, akaScore: votes.aka, aoScore: votes.ao }, ...prev].slice(0, 3));
      setQueue(prev => prev.filter(m => m.id !== activeMatchId));
    }

    try {
      const res = await fetch(`/api/competitions/${id}/brackets/${activeCategoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: activeMatchId, winnerId: realWinnerId, selectedKata: kataSelectionUsed, kataVotes: votes }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${winnerName} wins by ${votes.aka}–${votes.ao} judge votes!`);
      } else {
        toast.error('Failed to advance winner: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to finish kata match.');
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
    if (isOverriddenByAdmin) {
      toast.error('Controls are locked while Admin override is active.');
      return;
    }
    try {
      const { db } = await import('@lib/firebase');
      const { collection, getDocs, updateDoc, doc } = await import('firebase/firestore');
      
      const snaps = await getDocs(collection(db, 'competitions', id, 'categories'));
      const activeCatDocs = snaps.docs.filter(d => {
        const c = d.data();
        const catMatNum = parseInt(String(c.mat || '').replace(/\D/g, ''), 10);
        return (d.id === activeCategoryId) || (catMatNum === matNumber && (c.status === 'live' || c.status === 'upcoming'));
      });

      if (activeCatDocs.length === 0) {
        toast.error(`No active categories found on Mat ${matNum} to finish.`);
        return;
      }
      
      const targetDoc = activeCatDocs[0];
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
        const upcomingOnThisMat = snaps.docs.filter(d => {
          if (d.id === targetDoc.id) return false;
          const data = d.data();
          const catMatNum = parseInt(String(data.mat || '').replace(/\D/g, ''), 10);
          return catMatNum === matNumber && data.status === 'upcoming';
        });
        const batch = writeBatch(db);
        let shiftedCount = 0;
        
        upcomingOnThisMat.forEach(d => {
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


  const isKataCategory = activeCategoryData?.isKata || activeCategoryName?.toLowerCase().includes('kata') || false;
  const kataJudgeCount = activeCategoryData?.numberOfJudges || 3;
  const derivedKataData = React.useMemo(() => deriveJudgeVotes(kataScores, kataJudgeCount), [kataScores, kataJudgeCount]);


  const hasPasswordAuth = isMatSessionAuthorized(id, matIdParam, (k) => sessionStorage.getItem(k));

  if (!verified && !isViewer && role !== 'admin' && role !== 'mat_operator' && !hasPasswordAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--neutral-50)' }}>
        <p style={{ color: 'var(--neutral-500)', fontSize: '14px', fontWeight: 600 }}>Verifying credentials and assignments...</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      {/* FULLSCREEN OVERLAY */}
      {isFullscreen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', zIndex: 9999, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ScaleWrapper>
            {isKataCategory ? (
              <KataLiveScoreboard
                akaName={aka.name}
                aoName={ao.name}
                akaAcademy={aka.academy}
                aoAcademy={ao.academy}
                akaCountry={aka.country}
                aoCountry={ao.country}
                akaKataName={selectedKata?.aka?.name}
                aoKataName={selectedKata?.ao?.name}
                numberOfJudges={kataJudgeCount}
                judgeVotes={derivedKataData.judgeVotes}
                akaFlags={kataVotes?.aka ?? derivedKataData.akaFlags}
                aoFlags={kataVotes?.ao ?? derivedKataData.aoFlags}
                revealVotes={revealVotes}
                revealCountdown={revealCountdown}
                timeRemaining={`${Math.floor(timer / 60).toString().padStart(2, '0')}:${(timer % 60).toString().padStart(2, '0')}`}
                matchStatus={status === 'finished' ? 'COMPLETED' : (running ? 'LIVE' : status.toUpperCase())}
                logoUrl={compData?.scoreboardLogo || compData?.logoUrl}
                title={`Mat ${matNum}: Kata Scoreboard`}
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
                winnerAcademy={winnerState?.academy}
                nextMatch={queue[0] ? {
                  matchId: queue[0].displayId || queue[0].id,
                  aka: queue[0].aka,
                  ao: queue[0].ao,
                  akaAcademy: queue[0].akaAcademy,
                  aoAcademy: queue[0].aoAcademy,
                  category: queue[0].category,
                  akaReady: queue[0].akaReady,
                  aoReady: queue[0].aoReady,
                } : null}
                onDismissWinner={() => setWinnerState(null)}
                onProceedNextMatch={() => {
                  setWinnerState(null);
                  if (queue[0]) loadMatch(queue[0]);
                }}
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
                akaC1={(aka.c1?1:0) + (aka.c2?1:0) + (aka.c3?1:0) + (aka.hc?1:0) + (aka.h?1:0)}
                aoC1={(ao.c1?1:0) + (ao.c2?1:0) + (ao.c3?1:0) + (ao.hc?1:0) + (ao.h?1:0)}
                akaC2={0}
                aoC2={0}
                akaSenshu={aka.senshu}
                aoSenshu={ao.senshu}
                timerDisplay={`${Math.floor(timer / 60).toString().padStart(2, '0')}:${(timer % 60).toString().padStart(2, '0')}`}
                timerColor={timer <= 15 ? 'var(--aka)' : 'var(--status-live)'}
                matchStatus={timer === 0 ? 'TIME OVER' : running ? 'MATCH LIVE' : timer === matchDuration ? 'PRE-MATCH' : 'PAUSED'}
                title={compData?.name || 'KHEL KARATE'}
                categoryName={activeCategoryName || 'KUMITE'}
                logoUrl={compData?.scoreboardLogo || compData?.logoUrl}
                matchId={`MAT ${matNum} - ${queue.find(m => m.id === activeMatchId)?.displayId || '-'}`}
                winnerName={winnerState ? winnerState.name : undefined}
                winnerColor={winnerState ? winnerState.color : undefined}
                winnerAcademy={winnerState?.academy}
                nextMatch={queue[0] ? {
                  matchId: queue[0].displayId || queue[0].id,
                  aka: queue[0].aka,
                  ao: queue[0].ao,
                  akaAcademy: queue[0].akaAcademy,
                  aoAcademy: queue[0].aoAcademy,
                  category: queue[0].category,
                  akaReady: queue[0].akaReady,
                  aoReady: queue[0].aoReady,
                } : null}
                onDismissWinner={() => setWinnerState(null)}
                onProceedNextMatch={() => {
                  setWinnerState(null);
                  if (queue[0]) loadMatch(queue[0]);
                }}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => {
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(()=>{});
                  } else {
                    document.documentElement.requestFullscreen().catch(()=>{} );
                  }
                }}
                onBack={() => {
                  if (isViewer) {
                    window.location.href = `/competitions/${id}/mats`;
                  } else {
                    if (document.fullscreenElement) document.exitFullscreen();
                    setIsFullscreen(false);
                  }
                }}
              />
            )}
          </ScaleWrapper>
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
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--neutral-900)', color: '#fff', borderRadius: '10px', marginBottom: '20px', flexWrap: 'wrap', border: '1px solid var(--neutral-700)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-live)' }} />
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--neutral-400)' }}>
                Admin Mat Monitor:
              </span>
            </div>
            <Link
              href={`/competitions/${id}/mats`}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginRight: '8px'
              }}
            >
              ← All Mats
            </Link>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {Array.from({ length: compData?.mats || 6 }, (_, i) => {
                const currentNum = i + 1;
                const mNum = currentNum.toString().padStart(2, '0');
                const mId = `mat-${currentNum}`;
                const isCurrent = matNumber === currentNum;
                return (
                  <Link
                    key={mId}
                    href={`/competitions/${id}/operator?mat=${mId}`}
                    style={{
                      color: isCurrent ? '#000' : '#fff',
                      background: isCurrent ? 'var(--status-live)' : 'rgba(255,255,255,0.1)',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 800,
                      textDecoration: 'none',
                      boxShadow: isCurrent ? '0 0 10px rgba(34, 197, 94, 0.4)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    MAT {mNum}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        <header className="page-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: '1 1 min-content' }}>
            <div className="breadcrumb" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--neutral-500)', letterSpacing: '0.1em', marginBottom: '8px' }}>
              {compData?.name ? compData.name.toUpperCase() : 'TOURNAMENT'} • {activeCategoryName ? activeCategoryName.toUpperCase() : 'NO CATEGORY'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '40px', margin: 0, lineHeight: 1 }}>{`Mat ${matNum}`}</h1>
              <span className="status-chip status-live">Live</span>
              {activeCategoryName && (
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--neutral-500)', marginLeft: '4px' }}>
                  {activeCategoryName} {queue.find(m => m.id === activeMatchId)?.pool ? `(Pool ${queue.find(m => m.id === activeMatchId)?.pool})` : ''}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '0 1 auto' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLaunchTVScoreboard}
              title="Launch dedicated TV Scoreboard on secondary display / TV"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Tv size={16} />
              <span>Send to TV</span>
              {isTvConnected && (
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 8px #22c55e',
                    display: 'inline-block'
                  }}
                  title="TV Scoreboard Connected"
                />
              )}
            </button>

            {!isViewer && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStartCategory}
                  disabled={isOverriddenByAdmin}
                >
                  <Play size={16} /> Start Category
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleFinishCategory}
                  disabled={isOverriddenByAdmin}
                >
                  <Flag size={16} /> Finish Category
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleNextCategory}
                  disabled={isOverriddenByAdmin}
                >
                  Next Category
                </button>
              </>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                document.documentElement.requestFullscreen().catch(()=>{});
              }}
            >
              <Maximize size={16} /> Fullscreen
            </button>
          </div>
        </header>

        {/* Admin Mat Override Banner (for Operators) */}
        {isOverriddenByAdmin && (
          <div style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
            color: '#ffffff',
            padding: '16px 20px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={28} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Admin Mat Override Active
                </div>
                <div style={{ fontSize: '13px', opacity: 0.95, marginTop: '2px' }}>
                  Administrator <strong>{adminOverride?.adminName || 'Tournament Director'}</strong> has taken live control of this mat. Your local controls are locked and mirroring the administrator in real time.
                </div>
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '6px 14px',
              borderRadius: '999px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap'
            }}>
              Controls Locked
            </span>
          </div>
        )}

        <div
          className="mat-detail-grid"
          style={{
            pointerEvents: isOverriddenByAdmin ? 'none' : 'auto',
            opacity: isOverriddenByAdmin ? 0.7 : 1,
            position: 'relative',
            userSelect: isOverriddenByAdmin ? 'none' : 'auto'
          }}
        >
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <section className="ops-scoreboard">
              <div className="ops-header">
                <div>
                  <div style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Current Category</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{activeCategoryName || 'No Active Category'} {(activeCategoryData?.isKata || activeCategoryName?.toLowerCase().includes('kata')) && <span style={{ marginLeft: 6, padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: 4, fontSize: 11, fontWeight: 800 }}>KATA</span>}</div>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Match ID</div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{queue.find(m => m.id === activeMatchId)?.displayId || '-'}</div>
                  </div>
                </div>
              </div>

              {/* ── KATA: KataOperatorPanel / KUMITE: score display ── */}
              <>
                {isViewer ? (
                  <div id="ops-display-container" style={{ padding: '24px', background: '#fdfbfb', borderBottom: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: 'calc(100vh - 200px)', minHeight: '600px', background: '#000', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.1)' }}>
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
                          akaWazaari={aka.waza}
                          aoWazaari={ao.waza}
                          akaYuko={aka.yuko}
                          aoYuko={ao.yuko}
                          akaC1={(aka.c1?1:0) + (aka.c2?1:0) + (aka.c3?1:0) + (aka.hc?1:0) + (aka.h?1:0)}
                          aoC1={(ao.c1?1:0) + (ao.c2?1:0) + (ao.c3?1:0) + (ao.hc?1:0) + (ao.h?1:0)}
                          akaC2={0}
                          aoC2={0}
                          akaSenshu={aka.senshu}
                          aoSenshu={ao.senshu}
                          timerDisplay={`${mins}:${secs}`}
                          timerColor={timer <= 15 ? 'var(--aka)' : 'var(--status-live)'}
                          matchStatus={timer === 0 ? 'TIME OVER' : running ? 'MATCH LIVE' : timer === matchDuration ? 'PRE-MATCH' : 'PAUSED'}
                          title={compData?.name || 'KHEL KARATE'}
                          categoryName={activeCategoryName || 'KUMITE'}
                          matchId={`MAT ${new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('mat')?.replace('mat-', '').padStart(2, '0') || '01'} - ${queue.find(m => m.id === activeMatchId)?.displayId || '-'}`}
                          winnerName={winnerState ? winnerState.name : undefined}
                          winnerColor={winnerState ? winnerState.color : undefined}
                          winnerAcademy={winnerState?.academy}
                          nextMatch={queue[0] ? {
                            matchId: queue[0].displayId || queue[0].id,
                            aka: queue[0].aka,
                            ao: queue[0].ao,
                            akaAcademy: queue[0].akaAcademy,
                            aoAcademy: queue[0].aoAcademy,
                            category: queue[0].category,
                            akaReady: queue[0].akaReady,
                            aoReady: queue[0].aoReady,
                          } : null}
                          onDismissWinner={() => setWinnerState(null)}
                          onProceedNextMatch={() => {
                            setWinnerState(null);
                            if (queue[0]) loadMatch(queue[0]);
                          }}
                          isKata={!!isKata}
                          akaKataName={selectedKata?.aka?.name}
                          aoKataName={selectedKata?.ao?.name}
                        />
                      </ScaleWrapper>
                    </div>
                  </div>
                ) : isKataCategory ? (
              /* ─── KATA OPERATOR PANEL ─── */
              <div style={{ padding: '24px' }}>
                {activeMatchId && activeCategoryId ? (
                  <KataOperatorPanel
                    key={activeMatchId}
                    competitionId={id}
                    categoryId={activeCategoryId}
                    matchId={activeMatchId}
                    matId={matIdParam}
                    akaName={aka.name}
                    aoName={ao.name}
                    akaAcademy={aka.academy}
                    aoAcademy={ao.academy}
                    akaId={aka.id}
                    aoId={ao.id}
                    numberOfJudges={kataJudgeCount}
                    allowedKataNumbers={activeCategoryData?.allowedKataNumbers || []}
                    kataFormat={activeCategoryData?.kataFormat || 'elimination'}
                    isTeam={activeCategoryData?.isTeam}
                    onMatchFinished={handleKataMatchFinished}
                  />
                ) : (
                  <div style={{ padding: '32px 24px', background: 'linear-gradient(135deg, rgba(248,250,252,0.9) 0%, rgba(241,245,249,0.9) 100%)', borderRadius: '16px', border: '1.5px dashed var(--neutral-300)', textAlign: 'center' }}>
                    {queue.length > 0 ? (
                      <>
                        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--neutral-500)', marginBottom: '8px' }}>
                          Next Bout Ready to Stage
                        </div>
                        <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--neutral-900)' }}>
                          {queue[0].displayId}: {queue[0].aka} vs {queue[0].ao}
                        </h3>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
                          <div style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.06)', borderRadius: '12px', border: '1.5px solid rgba(239,68,68,0.2)', minWidth: '180px', textAlign: 'left' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--aka)', marginBottom: '2px' }}>AKA (RED)</div>
                            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--neutral-900)' }}>{queue[0].aka}</div>
                            <div style={{ fontSize: '12px', color: 'var(--neutral-500)', marginTop: '2px' }}>{queue[0].akaAcademy || 'Unattached'}</div>
                            <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 800, color: queue[0].akaReady ? '#059669' : '#dc2626' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: queue[0].akaReady ? '#10b981' : '#ef4444' }} />
                              {queue[0].akaReady ? 'READY' : 'NOT READY'}
                            </div>
                          </div>
                          <div style={{ alignSelf: 'center', fontWeight: 800, color: 'var(--neutral-400)', fontSize: '14px' }}>VS</div>
                          <div style={{ padding: '12px 20px', background: 'rgba(37,99,235,0.06)', borderRadius: '12px', border: '1.5px solid rgba(37,99,235,0.2)', minWidth: '180px', textAlign: 'left' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ao)', marginBottom: '2px' }}>AO (BLUE)</div>
                            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--neutral-900)' }}>{queue[0].ao}</div>
                            <div style={{ fontSize: '12px', color: 'var(--neutral-500)', marginTop: '2px' }}>{queue[0].aoAcademy || 'Unattached'}</div>
                            <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 800, color: queue[0].aoReady ? '#059669' : '#dc2626' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: queue[0].aoReady ? '#10b981' : '#ef4444' }} />
                              {queue[0].aoReady ? 'READY' : 'NOT READY'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            const readyCandidate = queue.find(m => m.akaReady && m.aoReady) || queue[0];
                            loadMatch(readyCandidate);
                            toast.success(`Loaded Match ${readyCandidate.displayId}: ${readyCandidate.aka} vs ${readyCandidate.ao}`);
                          }}
                          style={{
                            padding: '12px 28px',
                            fontSize: '14px',
                            fontWeight: 800,
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                          }}
                        >
                          🥋 Load Bout #{queue[0].displayId} to Operator Panel
                        </button>
                      </>
                    ) : (
                      <div style={{ color: 'var(--neutral-500)', fontWeight: 600 }}>
                        <p style={{ margin: 0, fontSize: '15px' }}>All matches in this category are completed.</p>
                        <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>Click "Finish Category" above to advance the mat schedule.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
                ) : (
              <div id="ops-display-container" className="ops-display">
                <div className="ops-side aka">
                  <div className="ops-country">{aka.country}</div>
                  <div className="ops-name">{aka.name}</div>
                  <div className="ops-academy">{aka.academy}</div>
                  {!isKata && <div className="ops-score-num aka">{aka.score}</div>}
                  
                  {isKata ? (
                    <div style={{ marginTop: '24px', width: '100%' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '8px' }}>Selected Kata</div>
                      <select 
                        value={selectedKata?.aka?.name || ''} 
                        onChange={e => {
                          const kata = KATA_LIST.find(k => k.name === e.target.value);
                          setSelectedKata((prev: any) => ({ ...prev, aka: kata || null }));
                          syncRTDB({ selectedKata: { ...selectedKata, aka: kata || null } });
                        }}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--neutral-300)' }}
                      >
                        <option value="">Select Kata...</option>
                        {KATA_LIST.map(k => <option key={k.number} value={k.name}>{k.name}</option>)}
                      </select>
                      <button onClick={() => {
                        const confirmDQ = window.confirm('Are you sure you want to disqualify AKA?');
                        if (confirmDQ) {
                          setWinnerState({ color: 'ao', name: ao.name, academy: ao.academy, points: 0 });
                          setStatus('finished');
                          setRunning(false);
                          syncRTDB({ winnerName: ao.name, winnerColor: 'ao', matchStatus: 'COMPLETED', timerRunning: false });
                          toast.success('AKA Disqualified. AO Wins.');
                        }
                      }} style={{ marginTop: '16px', background: 'var(--aka)', color: 'white', border: 'none', padding: '10px 12px', borderRadius: '6px', fontWeight: 700, width: '100%', cursor: 'pointer' }}>Disqualify AKA</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '8px', marginTop: '16px' }}>Penalties</div>
                      <div className="penalty-track">
                        {['c1', 'c2', 'c3', 'hc', 'h'].map((p) => (
                          <div className="pen-slot" key={p}>
                            <span className="pen-code">{p.toUpperCase()}</span>
                            <div className={`pen-dot ${(aka as any)[p] ? 'active' : ''}`} onClick={() => !isViewer && togglePenalty('aka', p as any)}></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="ops-side ops-center">
                  <div style={{ border: '1px solid var(--neutral-300)', padding: '4px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '24px' }}>
                    Match {queue.find(m => m.id === activeMatchId)?.displayId || '-'}
                  </div>

                  <div style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Remaining</div>
                  <div className={`ops-timer ${running ? 'live' : ''}`}>{mins}:{secs}</div>
                  <div style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Match Status</div>
                  <div style={{ background: 'var(--neutral-100)', padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-600)' }}>{status}</div>
                </div>

                <div className="ops-side ao">
                  <div className="ops-country">{ao.country}</div>
                  <div className="ops-name">{ao.name}</div>
                  <div className="ops-academy">{ao.academy}</div>
                  {!isKata && <div className="ops-score-num ao">{ao.score}</div>}
                  
                  {isKata ? (
                    <div style={{ marginTop: '24px', width: '100%' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '8px' }}>Selected Kata</div>
                      <select 
                        value={selectedKata?.ao?.name || ''} 
                        onChange={e => {
                          const kata = KATA_LIST.find(k => k.name === e.target.value);
                          setSelectedKata((prev: any) => ({ ...prev, ao: kata || null }));
                          syncRTDB({ selectedKata: { ...selectedKata, ao: kata || null } });
                        }}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--neutral-300)' }}
                      >
                        <option value="">Select Kata...</option>
                        {KATA_LIST.map(k => <option key={k.number} value={k.name}>{k.name}</option>)}
                      </select>
                      <button onClick={() => {
                        const confirmDQ = window.confirm('Are you sure you want to disqualify AO?');
                        if (confirmDQ) {
                          setWinnerState({ color: 'aka', name: aka.name, academy: aka.academy, points: 0 });
                          setStatus('finished');
                          setRunning(false);
                          syncRTDB({ winnerName: aka.name, winnerColor: 'aka', matchStatus: 'COMPLETED', timerRunning: false });
                          toast.success('AO Disqualified. AKA Wins.');
                        }
                      }} style={{ marginTop: '16px', background: 'var(--ao)', color: 'white', border: 'none', padding: '10px 12px', borderRadius: '6px', fontWeight: 700, width: '100%', cursor: 'pointer' }}>Disqualify AO</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '8px', marginTop: '16px' }}>Penalties</div>
                      <div className="penalty-track">
                        {['c1', 'c2', 'c3', 'hc', 'h'].map((p) => (
                          <div className="pen-slot" key={p}>
                            <span className="pen-code">{p.toUpperCase()}</span>
                            <div className={`pen-dot ${(ao as any)[p] ? 'active' : ''}`} onClick={() => !isViewer && togglePenalty('ao', p as any)}></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              )}

              {!isViewer && !isKataCategory && (
              <div className="ops-controls">
                <div className="round-ops-strip" style={{ borderBottom: '1px solid var(--neutral-200)', background: 'var(--shiro)' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Coffee size={14} /> Rest Timer
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {restRunning && restTimer > 0 ? (
                      <>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: '#f59e0b', minWidth: '40px', textAlign: 'center' }}>
                          {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
                        </span>
                        <button type="button" className="btn-round" onClick={() => { setRestRunning(false); setRestTimer(0); }}>Stop Rest</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn-round" onClick={() => { setRestTimer(30); setRestRunning(true); }}>30s</button>
                        <button type="button" className="btn-round" onClick={() => { setRestTimer(60); setRestRunning(true); }}>60s</button>
                        <button type="button" className="btn-round" onClick={() => { setRestTimer(90); setRestRunning(true); }}>90s</button>
                        <button type="button" className="btn-round" onClick={() => { setRestTimer(120); setRestRunning(true); }}>2m</button>
                      </>
                    )}
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
                    <button type="button" className="btn-round" onClick={() => setRunning(true)}><Play size={14} /> Start Timer</button>
                    <button type="button" className="btn-round" onClick={() => setRunning(false)}><Pause size={14} /> Stop Timer</button>
                    <div style={{ width: '1px', background: 'var(--neutral-200)', margin: '0 8px' }}></div>
                    <button type="button" className="btn-round" onClick={handleNextMatch}>Next Match</button>
                    <button type="button" className="btn-round" onClick={handleFinishMatch}><Flag size={14} /> Finish Match</button>
                    <button type="button" className="btn-round" style={{ color: 'var(--aka)', borderColor: 'rgba(225,29,72,0.3)' }} onClick={() => {

                      setAka(p => ({ ...p, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false }));
                      setAo(p => ({ ...p, score: 0, yuko: 0, waza: 0, ippon: 0, c1: 0, c2: 0, c3: 0, hc: 0, h: 0, senshu: false }));
                      setSelectedKata(null);
                      setTimer(matchDuration);
                      setRunning(false);
                      setStatus('upcoming');
                      setWinnerState(null);
                      syncRTDB({ selectedKata: null });
                    }}>↺ Reset Match</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px', borderBottom: '1px solid var(--neutral-200)' }}>
                  
                  {/* AKA Controls — Kumite only (kata uses KataOperatorPanel) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {!isKataCategory && (
                    <>
                        <div className="control-row" style={{ margin: 0 }}>
                          <button type="button" className="btn-score aka" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', 1)}>+1 Yuko</button>
                          <button type="button" className="btn-score aka" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', 2)}>+2 Waza</button>
                          <button type="button" className="btn-score aka" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', 3)}>+3 Ippon</button>
                        </div>
                        <div className="control-row" style={{ margin: 0 }}>
                          <button type="button" className="btn-score aka minus" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', -1)}>-1 Yuko</button>
                          <button type="button" className="btn-score aka minus" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', -2)}>-2 Waza</button>
                          <button type="button" className="btn-score aka minus" style={{ background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.2)' }} onClick={() => addPoint('aka', -3)}>-3 Ippon</button>
                        </div>
                        <div className="control-row" style={{ flexWrap: 'wrap', marginTop: '12px' }}>
                          <button type="button" className="btn-pen" onClick={() => toggleSenshu('aka')} style={{ background: aka.senshu ? 'var(--aka)' : 'var(--shiro)', color: aka.senshu ? '#fff' : 'var(--neutral-900)', borderColor: aka.senshu ? 'var(--aka)' : 'var(--neutral-300)', flex: '1 1 45%' }}>Senshu (AKA)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--aka)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('aka', 'c1')}>+ Penalty (C1)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--aka)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('aka', 'c2')}>+ Penalty (C2)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--aka)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('aka', 'c3')}>+ Penalty (C3)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--aka)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('aka', 'hc')}>+ Penalty (HC)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--aka)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('aka', 'h')}>+ Penalty (H)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--shiro)', flex: '1 1 45%', background: 'var(--aka)', borderColor: 'var(--aka)', fontWeight: 800 }} onClick={() => handleDisqualify('aka')}>Disqualify AKA</button>
                        </div>
                    </>
                    )}
                  </div>

                  {/* AO Controls — Kumite only */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {!isKataCategory && (
                    <>
                        <div className="control-row" style={{ margin: 0 }}>
                          <button type="button" className="btn-score ao" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', 1)}>+1 Yuko</button>
                          <button type="button" className="btn-score ao" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', 2)}>+2 Waza</button>
                          <button type="button" className="btn-score ao" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', 3)}>+3 Ippon</button>
                        </div>
                        <div className="control-row" style={{ margin: 0 }}>
                          <button type="button" className="btn-score ao minus" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', -1)}>-1 Yuko</button>
                          <button type="button" className="btn-score ao minus" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', -2)}>-2 Waza</button>
                          <button type="button" className="btn-score ao minus" style={{ background: 'rgba(26,77,181,0.05)', borderColor: 'rgba(26,77,181,0.2)' }} onClick={() => addPoint('ao', -3)}>-3 Ippon</button>
                        </div>
                        <div className="control-row" style={{ flexWrap: 'wrap', marginTop: '12px' }}>
                          <button type="button" className="btn-pen" onClick={() => toggleSenshu('ao')} style={{ background: ao.senshu ? 'var(--ao)' : 'var(--shiro)', color: ao.senshu ? '#fff' : 'var(--neutral-900)', borderColor: ao.senshu ? 'var(--ao)' : 'var(--neutral-300)', flex: '1 1 45%' }}>Senshu (AO)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--ao)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('ao', 'c1')}>+ Penalty (C1)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--ao)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('ao', 'c2')}>+ Penalty (C2)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--ao)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('ao', 'c3')}>+ Penalty (C3)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--ao)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('ao', 'hc')}>+ Penalty (HC)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--ao)', flex: '1 1 45%', background: 'var(--shiro)' }} onClick={() => togglePenalty('ao', 'h')}>+ Penalty (H)</button>
                          <button type="button" className="btn-pen" style={{ color: 'var(--shiro)', flex: '1 1 45%', background: 'var(--aka)', borderColor: 'var(--aka)', fontWeight: 800 }} onClick={() => handleDisqualify('ao')}>Disqualify AO</button>
                        </div>
                    </>
                    )}
                  </div>
                </div>
              </div>
              )}
              </>
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
                    {Object.keys(poolStatuses).sort((a,b) => {
                      if (a === 'finals') return 1;
                      if (b === 'finals') return -1;
                      return parseInt(a) - parseInt(b);
                    }).map(p => (
                      <option key={p} value={p}>{p === 'finals' ? 'Finals' : `Pool ${p}`} {poolStatuses[p] ? '(Done)' : '(Live)'}</option>
                    ))}
                  </select>
                  {!isViewer && (
                  <button type="button" 
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
                    {visibleQueue.length > 0 && visibleQueue.map((match, idx) => {
                      const isDraggable = !isViewer && match.id !== activeMatchId;
                      const isActive = match.id === activeMatchId;
                      const isBothReady = Boolean(match.akaReady && match.aoReady);
                      return (
                        <tr 
                          key={match.id}
                          draggable={isDraggable}
                          onDragStart={(e) => isDraggable && handleDragStart(e, idx)}
                          onDragOver={(e) => isDraggable && e.preventDefault()}
                          onDrop={(e) => isDraggable && handleDropQueue(e, idx)}
                          onClick={() => {
                            loadMatch(match);
                            toast.success(`Loaded Match ${match.displayId}: ${match.aka} vs ${match.ao}`);
                          }}
                          style={{  
                            borderBottom: '1px solid var(--neutral-100)',
                            backgroundColor: isActive 
                              ? 'rgba(16, 185, 129, 0.08)' 
                              : (isBothReady ? 'rgba(16, 185, 129, 0.04)' : (match.pool && poolStatuses[match.pool] ? '#ecfdf5' : 'transparent')),
                            borderLeft: isActive 
                              ? '4px solid #10b981' 
                              : (isBothReady ? '4px solid #34d399' : '4px solid transparent'),
                            cursor: 'pointer',
                            opacity: draggedIdx === idx ? 0.5 : 1,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isActive ? '#059669' : (idx === 0 ? 'inherit' : 'var(--neutral-500)') }}>
                            {match.displayId}
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: idx === 0 ? 800 : 700, fontSize: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span>{match.aka}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--neutral-500)', fontWeight: 500 }}>{match.akaAcademy || 'Unattached'}</span>
                                </div>
                                <span style={{ color: 'var(--neutral-400)', margin: '0 8px', fontWeight: 500 }}>vs</span> 
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span>{match.ao}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--neutral-500)', fontWeight: 500 }}>{match.aoAcademy || 'Unattached'}</span>
                                </div>
                                {isBothReady && !isActive && (
                                  <span style={{ padding: '2px 8px', background: '#d1fae5', color: '#065f46', borderRadius: '4px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em' }}>
                                    ⚡ READY TO PERFORM
                                  </span>
                                )}
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
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                              {isActive ? (
                                <span style={{ 
                                  background: '#ecfdf5', 
                                  color: '#065f46', 
                                  border: '1px solid #a7f3d0', 
                                  padding: '4px 10px', 
                                  borderRadius: '6px', 
                                  fontSize: '11px', 
                                  fontWeight: 800, 
                                  letterSpacing: '0.05em',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                                  LIVE ON MAT
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    loadMatch(match);
                                    toast.success(`Loaded Match ${match.displayId}: ${match.aka} vs ${match.ao}`);
                                  }}
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    background: isBothReady ? 'var(--status-live)' : 'var(--neutral-100)',
                                    color: isBothReady ? '#000' : 'var(--neutral-700)',
                                    border: isBothReady ? 'none' : '1px solid var(--neutral-300)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  {isBothReady ? '⚡ Load & Start' : 'Select'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
                  <button type="button" onClick={() => {
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
                        <button type="button"
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
              <button type="button" className="close-btn" onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-500)' }}><span style={{fontSize:'20px'}}>×</span></button>
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
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)} style={{ fontSize: '13px', fontWeight: 600 }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={async () => { setQueue(tempQueue); setShowEditModal(false); await saveQueueToFirestore(tempQueue); }} style={{ fontSize: '13px', fontWeight: 600 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Live Staff Station Reassignment - 5-Second Transfer Modal */}
      {reassignmentNotice?.active && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: 'rgba(8, 12, 22, 0.94)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)',
            border: '2px solid rgba(239, 68, 68, 0.5)',
            boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.9), 0 0 50px rgba(239, 68, 68, 0.25)',
            borderRadius: '24px',
            padding: '40px 32px',
            textAlign: 'center',
            color: '#ffffff',
            position: 'relative'
          }}>
            {/* Animated Pulsing Ring */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              position: 'relative'
            }}>
              <span style={{ fontSize: '32px' }}>🔄</span>
              <div style={{
                position: 'absolute',
                inset: '-6px',
                borderRadius: '50%',
                border: '2px solid rgba(239, 68, 68, 0.4)',
                animation: 'pulse 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
              }} />
            </div>

            <div style={{
              fontSize: '12px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#ef4444',
              marginBottom: '8px'
            }}>
              Station Reassigned by Admin
            </div>

            <h2 style={{
              fontSize: '26px',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              marginBottom: '16px',
              lineHeight: 1.2
            }}>
              You are assigned to {reassignmentNotice.toMatName}
            </h2>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '10px 20px',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <span style={{ color: 'var(--neutral-400)', fontWeight: 600 }}>{reassignmentNotice.fromMatName}</span>
              <span style={{ color: '#ef4444', fontWeight: 900 }}>➔</span>
              <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '16px' }}>{reassignmentNotice.toMatName}</span>
            </div>

            <p style={{
              color: 'var(--neutral-300)',
              fontSize: '14px',
              lineHeight: 1.6,
              marginBottom: '28px'
            }}>
              Your station has been updated live. Logging you out from <strong>{reassignmentNotice.fromMatName}</strong> and transferring you to <strong>{reassignmentNotice.toMatName}</strong> in <strong>{reassignmentNotice.countdown}s</strong>.
            </p>

            {/* Countdown Badge */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '28px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 900,
                color: '#ffffff',
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)'
              }}>
                {reassignmentNotice.countdown}s
              </div>
              <span style={{ fontSize: '12px', color: 'var(--neutral-400)', fontWeight: 500 }}>
                Transferring automatically...
              </span>
            </div>

            {/* Quick Action Button */}
            <button
              type="button"
              onClick={() => {
                window.location.href = `/competitions/${id}/operator?mat=${reassignmentNotice.toMatId}`;
              }}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '12px',
                background: '#ef4444',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '15px',
                letterSpacing: '0.02em',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <span>Go to {reassignmentNotice.toMatName} Now</span>
              <span>➔</span>
            </button>
          </div>
        </div>
      )}
      </div>
      </div>
    </Suspense>
  );
}

export default function OperatorPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PasswordGateway>
        <OperatorPortalInner id={id} />
      </PasswordGateway>
    </Suspense>
  );
}
