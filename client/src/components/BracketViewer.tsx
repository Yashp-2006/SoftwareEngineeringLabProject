'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Target, Maximize, MinusCircle, PlusCircle, Trophy, Check, ChevronDown } from 'lucide-react';

const METRICS = ["S", "Y", "W", "I", "C1", "C2", "C3", "HC", "H"];

const MetricTag = ({ label, initialActive = false }: { label: string, initialActive?: boolean }) => {
  const [active, setActive] = useState(initialActive);
  return (
    <div 
      className={`metric-tag ${active ? 'active' : ''}`} 
      onClick={() => setActive(!active)}
    >
      {label}
    </div>
  );
};

export default function BracketViewer({ matches, categoryName }: { matches: any[], categoryName?: string }) {
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const adjustZoom = (delta: number) => {
    setZoom(prev => Math.max(0.3, Math.min(2, prev + delta)));
  };

  const fitToScreen = () => {
    if (!viewportRef.current || !canvasRef.current) return;
    const margin = 100;
    const vWidth = viewportRef.current.clientWidth - margin;
    const vHeight = viewportRef.current.clientHeight - margin;
    
    const originalTransform = canvasRef.current.style.transform;
    canvasRef.current.style.transform = 'scale(1)';
    const cWidth = canvasRef.current.offsetWidth;
    const cHeight = canvasRef.current.offsetHeight;
    
    let newScale = Math.min(vWidth / cWidth, vHeight / cHeight);
    newScale = Math.max(0.3, Math.min(1.1, newScale));
    setZoom(newScale);
    
    viewportRef.current.scrollLeft = (canvasRef.current.scrollWidth - viewportRef.current.clientWidth) / 2;
    viewportRef.current.scrollTop = 0;
  };

  useEffect(() => {
    const timer = setTimeout(fitToScreen, 200);
    const handleResize = () => fitToScreen();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [matches]);

  const rounds: any[][] = [];
  let currentRound = 1;
  while(true) {
    const rMatches = matches.filter(m => m.round === currentRound).sort((a,b) => a.matchNumber - b.matchNumber);
    if(rMatches.length === 0) break;
    rounds.push(rMatches);
    currentRound++;
  }

  const getRoundName = (rIndex: number, totalRounds: number) => {
    if (rIndex === totalRounds - 1) return "Finals";
    if (rIndex === totalRounds - 2) return "Semi-Finals";
    if (rIndex === totalRounds - 3) return "Quarter-Finals";
    return `Round ${rIndex + 1}`;
  };

  if (!matches || matches.length === 0) return <div>No matches generated.</div>;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .bracket-viewport-internal {
          flex: 1;
          height: 100%;
          min-height: 500px;
          overflow: hidden; 
          background: var(--neutral-100);
          display: flex;
          flex-direction: column;
          border-radius: 12px;
        }
        .bracket-scroll-area {
          flex: 1;
          overflow: auto;
          padding: 0;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: oklch(99% 0.002 250); 
          background-image: 
            linear-gradient(var(--neutral-100) 1px, transparent 1px),
            linear-gradient(90deg, var(--neutral-100) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .bracket-container {
          display: flex;
          gap: 120px;
          padding: var(--space-8) var(--space-6);
          align-items: flex-start;
          transform-origin: top center;
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .bracket-round {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          min-width: 300px;
          position: relative;
        }
        .round-header {
          font-family: var(--font-display);
          font-size: 20px;
          color: var(--neutral-900);
          text-transform: uppercase;
          letter-spacing: 0.25em;
          text-align: center;
          padding: var(--space-4) 0;
          border-bottom: 4px solid var(--aka);
          margin-bottom: var(--space-6);
          position: sticky;
          top: 0;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          z-index: 5;
        }
        .bracket-node {
          width: 300px;
          background: var(--shiro);
          border: 1px solid var(--neutral-200);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02), 0 12px 32px -8px rgba(0,0,0,0.05);
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          position: relative;
        }
        .bracket-node:hover { 
          transform: translateY(-8px) scale(1.02); 
          border-color: var(--neutral-300);
          box-shadow: 0 32px 64px -16px rgba(0,0,0,0.1), 0 16px 32px -8px rgba(0,0,0,0.06);
        }
        .bracket-node.live { 
          border: 1px solid var(--status-live); 
          box-shadow: 0 0 0 4px var(--status-live-bg), 0 12px 32px -8px rgba(0,0,0,0.05);
        }
        .competitor-row {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-left: 8px solid transparent;
          min-height: 80px;
          position: relative;
        }
        .competitor-row.aka { border-left-color: var(--aka); }
        .competitor-row.ao { border-left-color: var(--ao); border-top: 1px solid var(--neutral-100); }
        .comp-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .comp-name { font-size: 15px; font-weight: 800; color: var(--neutral-900); letter-spacing: -0.02em; }
        .comp-team { font-size: 11px; color: var(--neutral-400); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
        .comp-score {
          font-family: var(--font-mono);
          font-size: 28px;
          font-weight: 900;
          color: var(--neutral-900);
          line-height: 1;
          margin-left: 16px;
          margin-top: 4px;
        }
        .match-footer {
          padding: 10px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          background: oklch(98% 0.002 250);
          border-top: 1px solid var(--neutral-100);
          height: 48px;
        }
        .match-wrapper {
          position: relative;
          margin-bottom: 24px;
        }
        .match-wrapper::after {
          content: '';
          position: absolute;
          right: -60px;
          top: 50%;
          width: 60px;
          height: 2px;
          background: var(--neutral-300);
          z-index: 0;
        }
        .bracket-round:last-child .match-wrapper::after {
          display: none;
        }
      `}} />

      <div className="bracket-viewport-internal">
        <div className="controls-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--shiro)', borderBottom: '1px solid var(--neutral-200)', zIndex: 10 }}>
          <div className="flex-center" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', margin: 0 }}>{categoryName || 'Tiesheet Preview'}</h2>
            <div className="mat-pill active" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--neutral-100)', color: 'var(--neutral-600)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
              {matches.length} Matches
            </div>
          </div>
          <div className="zoom-control" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', height: '28px', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }} onClick={fitToScreen}>
              <Maximize size={12} /> Fit to Screen
            </button>
            <MinusCircle size={16} style={{ cursor: 'pointer', color: 'var(--neutral-500)' }} onClick={() => adjustZoom(-0.1)} />
            <input 
              type="range" min="0.3" max="2" step="0.05" value={zoom} 
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              style={{ width: '80px' }}
            />
            <PlusCircle size={16} style={{ cursor: 'pointer', color: 'var(--neutral-500)' }} onClick={() => adjustZoom(0.1)} />
            <span style={{ minWidth: '40px', textAlign: 'right', fontSize: '12px', fontWeight: 600 }}>{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        <div className="bracket-scroll-area" ref={viewportRef}>
          <div className="bracket-container" id="bracket-canvas" ref={canvasRef} style={{ transform: `scale(${zoom})`, height: '100%' }}>
            {rounds.map((roundMatches, rIdx) => (
              <div key={rIdx} className="bracket-round">
                <div className="round-header">{getRoundName(rIdx, rounds.length)}</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
                  {roundMatches.map(m => (
                    <div key={m.id} className="match-wrapper">
                      <div className="bracket-node">
                        {m.status === 'live' && <div className="live-indicator"><div className="live-dot"></div> LIVE</div>}
                        <div className="competitor-row aka">
                          <div className="comp-info">
                            <div className="comp-name">{m.aka ? m.aka.name : 'BYE'}</div>
                            <div className="comp-team">{m.aka ? `${m.aka.state} • ${m.aka.academy}` : '—'}</div>
                          </div>
                          <div className="comp-score">{m.akaScore || 0}</div>
                        </div>
                        <div className="competitor-row ao">
                          <div className="comp-info">
                            <div className="comp-name">{m.ao ? m.ao.name : 'BYE'}</div>
                            <div className="comp-team">{m.ao ? `${m.ao.state} • ${m.ao.academy}` : '—'}</div>
                          </div>
                          <div className="comp-score">{m.aoScore || 0}</div>
                        </div>
                        <div className="match-footer">
                          <div className="text-micro" style={{ flex: 1, color: 'var(--neutral-400)', fontWeight: 700, letterSpacing: '0.1em' }}>
                            MATCH {m.matchNumber}
                          </div>
                          {m.mat && (
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--neutral-600)' }}>
                              MAT {m.mat}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
