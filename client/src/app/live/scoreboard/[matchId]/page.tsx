'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Maximize2, X, Play, Pause, RotateCcw } from 'lucide-react';

type FighterState = {
  name: string;
  score: number;
  ippon: number;
  wazaari: number;
  yuko: number;
  c1: number;
  c2: number;
  senshu: boolean;
};

export default function ScoreboardPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = React.use(params);

  const initialFighterState = (name: string): FighterState => ({
    name, score: 0, ippon: 0, wazaari: 0, yuko: 0, c1: 0, c2: 0, senshu: false
  });

  const [aka, setAka] = useState<FighterState>(initialFighterState('SATO'));
  const [ao, setAo] = useState<FighterState>(initialFighterState('MULLER'));
  
  const [timer, setTimer] = useState(180);
  const [running, setRunning] = useState(false);
  const [senshuClaimed, setSenshuClaimed] = useState(false);
  
  const [winnerOverlay, setWinnerOverlay] = useState<{ active: boolean, winner: string, classMode: string }>({
    active: false, winner: '', classMode: ''
  });

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
    if (confirm('Reset scoreboard?')) {
      setAka(initialFighterState('SATO'));
      setAo(initialFighterState('MULLER'));
      setTimer(180);
      setRunning(false);
      setSenshuClaimed(false);
      setWinnerOverlay({ active: false, winner: '', classMode: '' });
    }
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
  }, [addPoint, addPenalty, toggleTimer, resetAll, toggleFullscreen]);

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

  return (
    <div style={{ backgroundColor: 'var(--kuro)', color: 'var(--shiro)', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .scoreboard-container { flex: 1; display: grid; grid-template-columns: 1fr 320px 1fr; height: 100%; position: relative; }
        .side { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: var(--space-8); position: relative; transition: background-color 0.3s ease; }
        .side.aka { background: var(--aka); }
        .side.ao { background: var(--ao); }
        .athlete-name { font-family: var(--font-display); font-size: 120px; line-height: 1; text-transform: uppercase; text-align: center; margin-bottom: var(--space-2); text-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .athlete-country { font-family: var(--font-display); font-size: 32px; color: rgba(255,255,255,0.7); letter-spacing: 0.1em; margin-bottom: var(--space-8); }
        .score-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .score { font-family: var(--font-display); font-size: 380px; line-height: 0.8; margin: 0; color: var(--shiro); }
        .points-detail { display: flex; gap: var(--space-6); margin-top: var(--space-8); }
        .point-item { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
        .point-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; }
        .point-value { font-family: var(--font-display); font-size: 48px; }
        .penalties { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-top: var(--space-8); width: 100%; max-width: 400px; }
        .penalty-group { display: flex; flex-direction: column; gap: var(--space-2); cursor: pointer; }
        .penalty-title { font-size: 11px; font-weight: 700; text-transform: uppercase; opacity: 0.6; text-align: center; }
        .penalty-dots { display: flex; justify-content: center; gap: var(--space-2); }
        .dot { width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); transition: all 0.3s ease; }
        .dot.active { background: var(--shiro); box-shadow: 0 0 10px var(--shiro); }
        .senshu { position: absolute; top: 40px; font-family: var(--font-display); font-size: 24px; background: var(--shiro); color: var(--kuro); padding: 4px 12px; border-radius: 4px; opacity: 0; transition: opacity 0.3s ease; }
        .senshu.active { opacity: 1; }
        .center-column { display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: var(--space-6) 0; background: var(--kuro); border-left: 1px solid var(--neutral-900); border-right: 1px solid var(--neutral-900); z-index: 10; }
        .logo { font-family: var(--font-display); font-size: 32px; color: var(--shiro); letter-spacing: 0.1em; }
        .timer-wrap { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); }
        .timer { font-family: var(--font-mono); font-size: 96px; font-weight: 700; color: var(--status-live); }
        .match-info { text-align: center; }
        .match-number { font-family: var(--font-display); font-size: 24px; color: var(--neutral-500); margin-bottom: var(--space-2); }
        .category { font-family: var(--font-body); font-size: 14px; font-weight: 600; color: var(--neutral-300); text-transform: uppercase; max-width: 200px; }
        .controls-overlay { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); padding: var(--space-4) var(--space-6); border-radius: 100px; display: flex; gap: var(--space-6); border: 1px solid var(--neutral-700); opacity: 0; pointer-events: none; transition: all 0.3s ease; z-index: 100; }
        body:hover .controls-overlay { opacity: 1; pointer-events: auto; }
        .control-group { display: flex; align-items: center; gap: var(--space-3); }
        .control-btn { background: var(--neutral-900); border: 1px solid var(--neutral-700); color: var(--shiro); padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s ease; }
        .control-btn:hover { background: var(--neutral-700); transform: translateY(-1px); }
        .key-hint { font-size: 10px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: var(--neutral-300); }
        .fullscreen-btn { position: fixed; top: 24px; right: 24px; z-index: 100; background: rgba(0,0,0,0.5); border: 1px solid var(--neutral-700); color: var(--shiro); padding: 8px; border-radius: 8px; cursor: pointer; }
        .winner-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 200; opacity: 0; pointer-events: none; transition: opacity 0.5s ease; }
        .winner-overlay.active { opacity: 1; pointer-events: auto; }
        .winner-name { font-family: var(--font-display); font-size: 160px; text-transform: uppercase; margin-bottom: var(--space-2); }
        .winner-label { font-family: var(--font-display); font-size: 48px; color: var(--status-live); letter-spacing: 0.2em; }
        .winner-aka .winner-name { color: var(--aka); }
        .winner-ao .winner-name { color: var(--ao); }
      `}} />

      <button className="fullscreen-btn" onClick={toggleFullscreen} title="Toggle Fullscreen (F)">
        <Maximize2 size={16} />
      </button>

      <div className={`winner-overlay ${winnerOverlay.classMode} ${winnerOverlay.active ? 'active' : ''}`}>
        <div className="winner-label">MATCH WINNER</div>
        <div className="winner-name">{winnerOverlay.winner}</div>
        <button className="control-btn" style={{ marginTop: '40px' }} onClick={() => setWinnerOverlay({ ...winnerOverlay, active: false })}>
          <X size={16} /> Close
        </button>
      </div>

      <div className="scoreboard-container">
        {/* AKA SIDE */}
        <div className="side aka">
          <div className={`senshu ${aka.senshu ? 'active' : ''}`}>SENSHU</div>
          <div className="athlete-name">{aka.name}</div>
          <div className="athlete-country">JAPAN</div>
          
          <div className="score-wrap">
            <div className="score">{aka.score}</div>
          </div>

          <div className="points-detail">
            <div className="point-item">
              <div className="point-label">Ippon</div>
              <div className="point-value">{aka.ippon}</div>
            </div>
            <div className="point-item">
              <div className="point-label">Waza-ari</div>
              <div className="point-value">{aka.wazaari}</div>
            </div>
            <div className="point-item">
              <div className="point-label">Yuko</div>
              <div className="point-value">{aka.yuko}</div>
            </div>
          </div>

          <div className="penalties">
            <div className="penalty-group" onClick={() => addPenalty('aka', 'c1')}>
              <div className="penalty-title">Category 1</div>
              <div className="penalty-dots">
                {renderDots(aka.c1)}
              </div>
            </div>
            <div className="penalty-group" onClick={() => addPenalty('aka', 'c2')}>
              <div className="penalty-title">Category 2</div>
              <div className="penalty-dots">
                {renderDots(aka.c2)}
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN */}
        <div className="center-column">
          <div className="logo">TAIKAIX</div>
          
          <div className="timer-wrap">
            <div className="timer" style={{ color: timer <= 15 ? 'var(--aka)' : 'var(--status-live)' }}>
              {formatTime(timer)}
            </div>
            <div style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.2em', color: running ? 'var(--status-live)' : 'var(--neutral-500)' }}>
              {timer === 0 ? 'TIME OVER' : running ? 'MATCH LIVE' : timer === 180 ? 'PRE-MATCH' : 'PAUSED'}
            </div>
          </div>

          <div className="match-info">
            <div className="match-number">MAT 01 - MATCH 42</div>
            <div className="category">Senior Male Kumite -75kg</div>
          </div>
        </div>

        {/* AO SIDE */}
        <div className="side ao">
          <div className={`senshu ${ao.senshu ? 'active' : ''}`}>SENSHU</div>
          <div className="athlete-name">{ao.name}</div>
          <div className="athlete-country">GERMANY</div>
          
          <div className="score-wrap">
            <div className="score">{ao.score}</div>
          </div>

          <div className="points-detail">
            <div className="point-item">
              <div className="point-label">Ippon</div>
              <div className="point-value">{ao.ippon}</div>
            </div>
            <div className="point-item">
              <div className="point-label">Waza-ari</div>
              <div className="point-value">{ao.wazaari}</div>
            </div>
            <div className="point-item">
              <div className="point-label">Yuko</div>
              <div className="point-value">{ao.yuko}</div>
            </div>
          </div>

          <div className="penalties">
            <div className="penalty-group" onClick={() => addPenalty('ao', 'c1')}>
              <div className="penalty-title">Category 1</div>
              <div className="penalty-dots">
                {renderDots(ao.c1)}
              </div>
            </div>
            <div className="penalty-group" onClick={() => addPenalty('ao', 'c2')}>
              <div className="penalty-title">Category 2</div>
              <div className="penalty-dots">
                {renderDots(ao.c2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLS OVERLAY */}
      <div className="controls-overlay">
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
      </div>
    </div>
  );
}
