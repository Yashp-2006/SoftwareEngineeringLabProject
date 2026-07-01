'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Maximize, MinusCircle, PlusCircle } from 'lucide-react';

export default function BracketViewer({ matches, categoryName, isKata: propIsKata }: { matches: any[], categoryName?: string, isKata?: boolean }) {
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [connectors, setConnectors] = useState<Array<{x1:number;y1:number;x2:number;y2:number;xMid:number}>>([]);

  const adjustZoom = (delta: number) => {
    setZoom(prev => Math.max(0.2, Math.min(2, +(prev + delta).toFixed(2))));
  };

  const fitToScreen = useCallback(() => {
    if (!scrollAreaRef.current || !canvasRef.current) return;
    const margin = 48;
    const vWidth = scrollAreaRef.current.clientWidth - margin;
    const vHeight = scrollAreaRef.current.clientHeight - margin;
    // Get natural dimensions (at scale 1) by temporarily reading offsetWidth/Height
    // These are the real pixel dimensions before any CSS transform
    const naturalW = canvasRef.current.offsetWidth;
    const naturalH = canvasRef.current.offsetHeight;
    if (naturalW === 0 || naturalH === 0) return;
    const newScale = Math.max(0.2, Math.min(1.2, Math.min(vWidth / naturalW, vHeight / naturalH)));
    setZoom(newScale);
  }, []);

  // Ctrl/Cmd + scroll wheel zoom
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.07 : 0.07;
        setZoom(prev => Math.max(0.2, Math.min(2, +(prev + delta).toFixed(2))));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Auto fit on first render after matches load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!scrollAreaRef.current || !canvasRef.current) return;
      const margin = 48;
      const vWidth = scrollAreaRef.current.clientWidth - margin;
      const vHeight = scrollAreaRef.current.clientHeight - margin;
      const naturalW = canvasRef.current.offsetWidth;
      const naturalH = canvasRef.current.offsetHeight;
      if (naturalW === 0 || naturalH === 0) return;
      const newScale = Math.max(0.2, Math.min(1, Math.min(vWidth / naturalW, vHeight / naturalH)));
      setZoom(newScale);
    }, 300);
    return () => clearTimeout(timer);
  }, [matches]);

  const rounds: any[][] = [];
  let currentRound = 1;
  while (true) {
    const rMatches = matches.filter(m => m.round === currentRound).sort((a, b) => a.matchNumber - b.matchNumber);
    if (rMatches.length === 0) break;
    rounds.push(rMatches);
    currentRound++;
  }

  const isKata = propIsKata !== undefined ? propIsKata : (categoryName?.toLowerCase().includes('kata') || false);

  // ── SVG Connector Computation ── (must stay above early return to satisfy Rules of Hooks)
  const computeConnectors = useCallback(() => {
    if (!canvasRef.current || rounds.length < 2) {
      setConnectors([]);
      return;
    }
    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    const newConnectors: Array<{x1:number;y1:number;x2:number;y2:number;xMid:number}> = [];

    // Map each match to its DOM element
    const matchNodes = new Map<string, HTMLElement>();
    canvas.querySelectorAll('.match-wrapper').forEach((el: any) => {
      if (el.__matchId) matchNodes.set(el.__matchId, el);
    });

    for (const match of matches) {
      if (!match.nextMatchId) continue;
      const src = matchNodes.get(match.id);
      const dest = matchNodes.get(match.nextMatchId);
      if (!src || !dest) continue;

      const srcRect = src.getBoundingClientRect();
      const destRect = dest.getBoundingClientRect();

      // Divide by zoom because getBoundingClientRect() returns scaled screen pixels
      const x1 = (srcRect.right - canvasRect.left) / zoom;
      const y1 = (srcRect.top + srcRect.height / 2 - canvasRect.top) / zoom;
      const x2 = (destRect.left - canvasRect.left) / zoom;
      const y2 = (destRect.top + destRect.height / 2 - canvasRect.top) / zoom;
      const xMid = x1 + (x2 - x1) / 2;

      newConnectors.push({ x1, y1, x2, y2, xMid });
    }
    setConnectors(newConnectors);
  }, [matches, rounds.length, zoom]);

  useEffect(() => {
    const timer = setTimeout(computeConnectors, 350);
    return () => clearTimeout(timer);
  }, [computeConnectors, zoom, matches]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(() => setTimeout(computeConnectors, 100));
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [computeConnectors]);

  // Early return AFTER all hooks so React sees a consistent hook call order
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
          background: oklch(99% 0.002 250);
          background-image:
            linear-gradient(var(--neutral-100) 1px, transparent 1px),
            linear-gradient(90deg, var(--neutral-100) 1px, transparent 1px);
          background-size: 40px 40px;
          position: relative;
        }
        /* Wrapper that gets scaled — transform-origin top left so content grows rightward/downward */
        .bracket-scale-wrapper {
          display: inline-block;
          transform-origin: top left;
          transition: transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .bracket-container {
          display: flex;
          gap: 120px;
          padding: 32px 24px 48px;
          align-items: flex-start;
          position: relative;
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
        .comp-stats {
          display: flex;
          gap: 6px;
          margin-top: 4px;
          flex-wrap: wrap;
        }
        .stat-chip {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          background: var(--neutral-100);
          color: var(--neutral-600);
        }
        .stat-chip.senshu {
          background: #fef3c7;
          color: #b45309;
        }
        .stat-chip.penalty {
          background: #fee2e2;
          color: #dc2626;
        }
        .comp-kata-name {
          font-size: 13px;
          font-weight: 800;
          color: var(--neutral-600);
          text-transform: uppercase;
          margin-left: 16px;
          text-align: right;
          max-width: 120px;
          display: flex;
          align-items: center;
          line-height: 1.2;
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
        .bracket-round:last-child .match-wrapper::after {
          display: none;
        }
      `}} />

      <div className="bracket-viewport-internal">
        {/* Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--shiro)', borderBottom: '1px solid var(--neutral-200)', zIndex: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', margin: 0 }}>{categoryName || 'Tiesheet Preview'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--neutral-100)', color: 'var(--neutral-600)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
              {matches.length} Matches
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '11px', height: '28px', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}
              onClick={fitToScreen}
            >
              <Maximize size={12} /> Fit to Screen
            </button>
            <MinusCircle size={16} style={{ cursor: 'pointer', color: 'var(--neutral-500)' }} onClick={() => adjustZoom(-0.1)} />
            <input
              type="range" min="0.2" max="2" step="0.05" value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              style={{ width: '80px', accentColor: 'var(--aka)' }}
            />
            <PlusCircle size={16} style={{ cursor: 'pointer', color: 'var(--neutral-500)' }} onClick={() => adjustZoom(0.1)} />
            <span style={{ minWidth: '40px', textAlign: 'right', fontSize: '12px', fontWeight: 600 }}>{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Scrollable canvas area */}
        <div className="bracket-scroll-area" ref={scrollAreaRef}>
          {/* Scale wrapper: transform-origin top left means content expands to the right/bottom */}
          <div className="bracket-scale-wrapper" style={{ transform: `scale(${zoom})` }}>
            <div className="bracket-container" ref={canvasRef}>
              {/* SVG Connector Overlay */}
              {connectors.length > 0 && (
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                  {connectors.map((c, i) => (
                    <path
                      key={i}
                      d={`M${c.x1},${c.y1} L${c.xMid},${c.y1} L${c.xMid},${c.y2} L${c.x2},${c.y2}`}
                      fill="none"
                      stroke="var(--neutral-300)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
              )}
              {rounds.map((roundMatches, rIdx) => (
                <div key={rIdx} className="bracket-round">
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
                    {roundMatches.map(m => (
                      <div key={m.id} className="match-wrapper" ref={(el) => { if (el) (el as any).__matchId = m.id; }}>
                        <div className={`bracket-node${m.status === 'live' ? ' live' : ''}`}>
                          {m.status === 'live' && (
                            <div className="live-indicator"><div className="live-dot"></div> LIVE</div>
                          )}
                          <div className="competitor-row aka">
                            <div className="comp-info">
                              <div className="comp-name" style={{ color: m.aka ? 'inherit' : 'var(--neutral-400)' }}>{m.aka ? m.aka.name : 'No player assigned'}</div>
                              <div className="comp-team">{m.aka ? `${m.aka.state} • ${m.aka.academy}` : '—'}</div>
                              {!isKata && m.aka && (
                                <div className="comp-stats">
                                  {(m.akaIppon > 0 || m.akaWazaari > 0 || m.akaYuko > 0) && (
                                    <>
                                      {m.akaIppon > 0 && <span className="stat-chip">I:{m.akaIppon}</span>}
                                      {m.akaWazaari > 0 && <span className="stat-chip">W:{m.akaWazaari}</span>}
                                      {m.akaYuko > 0 && <span className="stat-chip">Y:{m.akaYuko}</span>}
                                    </>
                                  )}
                                  {m.akaSenshu && <span className="stat-chip senshu">SENSHU</span>}
                                  {(m.akaC1 > 0 || m.akaC2 > 0) && (
                                    <>
                                      {m.akaC1 > 0 && <span className="stat-chip penalty">C1:{m.akaC1}</span>}
                                      {m.akaC2 > 0 && <span className="stat-chip penalty">C2:{m.akaC2}</span>}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            {isKata && m.aka && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '12px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--neutral-500)', padding: '4px 10px', background: 'var(--neutral-50)', borderRadius: '6px' }}>
                                  {m.akaKata ? m.akaKata : ''}
                                </div>
                                {(m.akaScore !== undefined && m.akaScore !== null) && (
                                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--aka)' }}>
                                    Flags: {m.akaScore}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="comp-score">{(m.akaScore !== undefined && m.akaScore !== null && m.akaScore !== '') ? m.akaScore : ''}</div>
                          </div>
                          <div className="competitor-row ao">
                            <div className="comp-info">
                              <div className="comp-name" style={{ color: m.ao ? 'inherit' : 'var(--neutral-400)' }}>{m.ao ? m.ao.name : 'No player assigned'}</div>
                              <div className="comp-team">{m.ao ? `${m.ao.state} • ${m.ao.academy}` : '—'}</div>
                              {!isKata && m.ao && (
                                <div className="comp-stats">
                                  {(m.aoIppon > 0 || m.aoWazaari > 0 || m.aoYuko > 0) && (
                                    <>
                                      {m.aoIppon > 0 && <span className="stat-chip">I:{m.aoIppon}</span>}
                                      {m.aoWazaari > 0 && <span className="stat-chip">W:{m.aoWazaari}</span>}
                                      {m.aoYuko > 0 && <span className="stat-chip">Y:{m.aoYuko}</span>}
                                    </>
                                  )}
                                  {m.aoSenshu && <span className="stat-chip senshu">SENSHU</span>}
                                  {(m.aoC1 > 0 || m.aoC2 > 0) && (
                                    <>
                                      {m.aoC1 > 0 && <span className="stat-chip penalty">C1:{m.aoC1}</span>}
                                      {m.aoC2 > 0 && <span className="stat-chip penalty">C2:{m.aoC2}</span>}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            {isKata && m.ao && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '12px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--neutral-500)', padding: '4px 10px', background: 'var(--neutral-50)', borderRadius: '6px' }}>
                                  {m.aoKata ? m.aoKata : ''}
                                </div>
                                {(m.aoScore !== undefined && m.aoScore !== null) && (
                                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ao)' }}>
                                    Flags: {m.aoScore}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="comp-score">{(m.aoScore !== undefined && m.aoScore !== null && m.aoScore !== '') ? m.aoScore : ''}</div>
                          </div>
                          <div className="match-footer">
                            <div className="text-micro" style={{ flex: 1, color: 'var(--neutral-400)', fontWeight: 700, letterSpacing: '0.1em' }}>
                              MATCH {m.matchNumber}
                            </div>
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
      </div>
    </>
  );
}
