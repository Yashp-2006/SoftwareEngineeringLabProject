'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Maximize, MinusCircle, PlusCircle, X, ChevronDown, Check, Target, ArrowRight } from 'lucide-react';

const METRICS = ['S', 'Y', 'W', 'I', 'C1', 'C2', 'C3', 'HC', 'H'];

// --- MetricTag: read-only scoring tag (S, Y, W, etc.) ---
const MetricTag = ({ label, isAo, isActive = false }: { label: string; isAo: boolean; isActive?: boolean }) => {
  return (
    <div className={`metric-tag${isActive ? (isAo ? ' active-ao' : ' active-aka') : ''}`}>
      {label}
    </div>
  );
};

// --- BracketNode: one match card ---
const BracketNode = ({
  match,
  mats,
  isHighlighted = false,
  onPromote,
}: {
  match: any;
  mats: string[];
  isHighlighted?: boolean;
  onPromote?: (matchId: string, winnerId: string, nextMatchId: string | null, byeFor?: 'aka' | 'ao') => void;
}) => {
  const [showPromoteMenu, setShowPromoteMenu] = useState(false);
  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';
  const isPending = !match.aka && !match.ao;

  const akaId = match.aka?.playerId;
  const aoId = match.ao?.playerId;
  const hasAka = !!match.aka;
  const hasAo = !!match.ao;

  // Auto-detect: if only one side has a player, they win by BYE automatically
  const onlyAka = hasAka && !hasAo;
  const onlyAo = !hasAka && hasAo;

  const handlePromoteClick = () => {
    if (!onPromote) return;
    // If match already has a computed winner (from scoreboard), promote directly
    if (match.winnerId) {
      onPromote(match.id, match.winnerId, match.nextMatchId);
      return;
    }
    // If only one competitor (BYE match), auto-promote
    if (onlyAka) { onPromote(match.id, akaId, match.nextMatchId, 'ao'); return; }
    if (onlyAo) { onPromote(match.id, aoId, match.nextMatchId, 'aka'); return; }
    // Otherwise show picker
    setShowPromoteMenu(v => !v);
  };

  return (
    <div className={`bracket-node${isLive ? ' live' : ''}${isCompleted ? ' completed' : ''}${isPending ? ' pending' : ''}${isHighlighted ? ' is-highlighted' : ''}`}>
      {isLive && (
        <div className="live-indicator">
          <div className="live-dot" />
          LIVE
        </div>
      )}

      {/* AKA Row */}
      <div className={`competitor-row aka${isCompleted && match.winnerId && match.winnerId !== akaId ? ' loser' : ''}${isCompleted && match.winnerId && match.winnerId === akaId ? ' winner' : ''}`}>
        <div className="comp-info">
          <div className="comp-name">
            {match.aka ? match.aka.name.toUpperCase() : (
              match.akaFromMatchId ? <span style={{ color: 'var(--neutral-400)', fontStyle: 'normal' }}>WINNER M{match.akaFromMatchId}</span> : <span style={{ color: 'var(--neutral-400)' }}>Empty</span>
            )}
          </div>
          {match.aka && (
            <div className="comp-team">
              {[match.aka.academy, match.aka.state || match.aka.country].filter(Boolean).join(' • ').toUpperCase()}
            </div>
          )}
          {match.aka && (
            <div className="metrics-row">
              {METRICS.map(m => (
                <React.Fragment key={m}>
                  <MetricTag label={m} isAo={false} />
                  {m === 'I' && <div style={{ width: 24 }} />}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        <div className="comp-score">{match.akaScore ?? (match.aka ? 0 : '')}</div>
      </div>

      {/* AO Row */}
      <div className={`competitor-row ao${isCompleted && match.winnerId && match.winnerId !== aoId ? ' loser' : ''}${isCompleted && match.winnerId && match.winnerId === aoId ? ' winner' : ''}`}>
        <div className="comp-info">
          <div className="comp-name">
            {match.ao ? match.ao.name.toUpperCase() : (
              match.aoFromMatchId ? <span style={{ color: 'var(--neutral-400)', fontStyle: 'normal' }}>WINNER M{match.aoFromMatchId}</span> : <span style={{ color: 'var(--neutral-400)' }}>Empty</span>
            )}
          </div>
          {match.ao && (
            <div className="comp-team">
              {[match.ao.academy, match.ao.state || match.ao.country].filter(Boolean).join(' • ').toUpperCase()}
            </div>
          )}
          {match.ao && (
            <div className="metrics-row">
              {METRICS.map(m => (
                <React.Fragment key={m}>
                  <MetricTag label={m} isAo={true} />
                  {m === 'I' && <div style={{ width: 24 }} />}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        <div className="comp-score">{match.aoScore ?? (match.ao ? 0 : '')}</div>
      </div>

      {/* Match Footer */}
      <div className="match-footer" style={{ position: 'relative' }}>
        {isPending ? (
          <div className="text-micro" style={{ flex: 1, color: 'var(--neutral-400)', fontWeight: 700, letterSpacing: '0.1em' }}>
            PENDING QUALIFICATION
          </div>
        ) : (
          <>
            <div className="text-micro" style={{ flex: 1, color: 'var(--neutral-400)', fontWeight: 700, letterSpacing: '0.1em' }}>
              {isCompleted ? (
                <span style={{ color: 'var(--status-live)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={11} /> COMPLETED {match.byeFor ? `(${match.byeFor.toUpperCase()} BYE)` : ''}
                </span>
              ) : `MATCH ${match.matchNumber}`}
            </div>
            {onPromote && !isCompleted && (
              <div style={{ position: 'relative' }}>
                <button
                  className="btn-promote"
                  title="Promote winner"
                  onClick={handlePromoteClick}
                >
                  <ArrowRight size={18} />
                </button>
                {showPromoteMenu && (
                  <div style={{
                    position: 'absolute', bottom: '110%', right: 0,
                    background: 'var(--shiro)', border: '1px solid var(--neutral-200)',
                    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 200, minWidth: '200px', overflow: 'hidden'
                  }}>
                    <div style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 800, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--neutral-100)' }}>
                      Promote to Next Round
                    </div>
                    {hasAka && (
                      <button
                        onClick={() => { onPromote(match.id, akaId, match.nextMatchId); setShowPromoteMenu(false); }}
                        style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--aka)', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--aka-light)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--aka)', display: 'inline-block', flexShrink: 0 }} />
                        AKA — {match.aka?.name}
                      </button>
                    )}
                    {hasAo && (
                      <button
                        onClick={() => { onPromote(match.id, aoId, match.nextMatchId); setShowPromoteMenu(false); }}
                        style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--ao)', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--ao-light)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ao)', display: 'inline-block', flexShrink: 0 }} />
                        AO — {match.ao?.name}
                      </button>
                    )}
                    {(hasAka || hasAo) && <div style={{ height: '1px', background: 'var(--neutral-100)' }} />}
                    {hasAka && (
                      <button
                        onClick={() => { onPromote(match.id, akaId, match.nextMatchId, 'ao'); setShowPromoteMenu(false); }}
                        style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--neutral-500)', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--neutral-50)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        AKA wins by BYE (AO absent/DQ)
                      </button>
                    )}
                    {hasAo && (
                      <button
                        onClick={() => { onPromote(match.id, aoId, match.nextMatchId, 'aka'); setShowPromoteMenu(false); }}
                        style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--neutral-500)', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--neutral-50)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        AO wins by BYE (AKA absent/DQ)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {isCompleted && onPromote && match.winnerId && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-live)' }}>
                ✓ Advanced
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// --- BracketViewer: the zoomable bracket canvas ---
export function BracketViewer({
  matches,
  categoryName,
  mats = [],
  firstRoundOnly = false,
  highlightMatchId,
  allCategories,
  onNavigateToMatch,
  onPromote,
}: {
  matches: any[];
  categoryName?: string;
  mats?: string[];
  firstRoundOnly?: boolean;
  highlightMatchId?: string | null;
  allCategories?: any[];
  onNavigateToMatch?: (categoryId: string, matchId: string) => void;
  onPromote?: (matchId: string, winnerId: string, nextMatchId: string | null, byeFor?: 'aka' | 'ao') => void;
}) {
  const availablePools = Array.from(new Set((matches || []).filter(m => m.id.startsWith('Pool')).map(m => m.id.split('-')[0].replace('Pool', '')))).sort();
  const [selectedPool, setSelectedPool] = useState<string | null>(null);

  const [localSearch, setLocalSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [localHighlightMatchId, setLocalHighlightMatchId] = useState<string | null>(null);
  const activeHighlight = localHighlightMatchId || highlightMatchId;

  const searchResults = React.useMemo(() => {
    if (!localSearch || localSearch.trim().length < 2 || !isDropdownOpen) return [];
    const q = localSearch.toLowerCase().trim();
    const results: any[] = [];
    
    const catsToSearch = allCategories && allCategories.length > 0 ? allCategories : [{ id: 'current', name: categoryName, matches }];
    
    for (const cat of catsToSearch) {
      const catMatch = (cat.name || '').toLowerCase().includes(q);
      for (const m of (cat.matches || [])) {
        const akaName = m.aka?.name || '';
        const aoName = m.ao?.name || '';
        
        const akaMatch = akaName.toLowerCase().includes(q);
        const aoMatch = aoName.toLowerCase().includes(q);
        
        if (akaMatch || aoMatch || catMatch) {
          results.push({
            categoryId: cat.id,
            categoryName: cat.name,
            matchId: m.id,
            athleteName: akaMatch ? akaName : (aoMatch ? aoName : (akaName || aoName || 'BYE')),
            teamName: akaMatch ? m.aka?.academy : (aoMatch ? m.ao?.academy : ''),
            pool: m.id.split('-')[0].replace('Pool', ''),
          });
        }
        if (results.length >= 50) break;
      }
      if (results.length >= 50) break;
    }
    
    return results;
  }, [allCategories, categoryName, matches, localSearch, isDropdownOpen]);

  const handleSearchResultClick = (result: any) => {
    onNavigateToMatch?.(result.categoryId, result.matchId);
    setLocalSearch(`${result.athleteName} - ${result.categoryName}`);
    setIsDropdownOpen(false);
  };

  // Set default pool if not set, prioritize activeHighlight's pool
  useEffect(() => {
    if (availablePools.length > 0) {
      if (activeHighlight && activeHighlight.startsWith('Pool')) {
        const highlightPool = activeHighlight.split('-')[0].replace('Pool', '');
        if (availablePools.includes(highlightPool)) {
          setSelectedPool(highlightPool);
          return;
        }
      }
      
      if (!selectedPool || !availablePools.includes(selectedPool)) {
        setSelectedPool(availablePools[0]);
      }
    }
  }, [availablePools, selectedPool, activeHighlight]);

  const filteredMatches = (availablePools.length > 0 && selectedPool)
    ? (matches || []).filter(m => m.id.startsWith(`Pool${selectedPool}-`))
    : (matches || []);

  const [zoom, setZoom] = useState(1);
  const [isManualZoom, setIsManualZoom] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Reset manual zoom when switching categories
  useEffect(() => {
    setIsManualZoom(false);
  }, [categoryName]);

  const adjustZoom = (delta: number) => {
    setIsManualZoom(true);
    setZoom(prev => Math.max(0.3, Math.min(2, +(prev + delta).toFixed(2))));
  };

  const fitToScreen = useCallback(() => {
    if (isManualZoom) return;
    if (!viewportRef.current || !canvasRef.current) return;
    const margin = 60;
    const vW = viewportRef.current.clientWidth - margin;
    const vH = viewportRef.current.clientHeight - margin;
    // Read natural dimensions (offsetWidth/Height always reflect layout without CSS transform)
    const cW = canvasRef.current.offsetWidth;
    const cH = canvasRef.current.offsetHeight;
    if (cW === 0 || cH === 0) return;
    const scale = Math.max(0.2, Math.min(1.2, Math.min(vW / cW, vH / cH)));
    setZoom(scale);
  }, [isManualZoom]);

  useEffect(() => {
    const t = setTimeout(fitToScreen, 200);
    window.addEventListener('resize', fitToScreen);
    return () => { clearTimeout(t); window.removeEventListener('resize', fitToScreen); };
  }, [filteredMatches, fitToScreen]);

  // Group matches by round
  const roundMap = new Map<number, any[]>();
  filteredMatches.forEach(m => {
    if (!roundMap.has(m.round)) roundMap.set(m.round, []);
    roundMap.get(m.round)!.push(m);
  });
  const rounds = Array.from(roundMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, ms]) => ms.sort((a: any, b: any) => a.matchNumber - b.matchNumber));



  const visibleRounds = firstRoundOnly ? (rounds.length > 0 ? [rounds[0]] : []) : rounds;

  if (!matches || matches.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-400)', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '48px' }}>⚔️</div>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>No matches generated yet.</div>
      </div>
    );
  }

  return (
    <div className="bv-viewport">
      {/* Controls Bar */}
      <div className="bv-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '18px', margin: 0 }}>{categoryName || 'Tiesheet'}</h2>
          
          {availablePools.length > 0 && (
            <select
              value={selectedPool || ''}
              onChange={(e) => setSelectedPool(e.target.value)}
              className="pool-select"
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--neutral-300)',
                background: 'var(--shiro)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--neutral-800)',
                cursor: 'pointer'
              }}
            >
              {availablePools.map(p => (
                <option key={p} value={p}>Pool {p}</option>
              ))}
            </select>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--neutral-100)', color: 'var(--neutral-600)', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
            {filteredMatches.length} Matches
          </div>
        </div>
        <div className="bv-zoom">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Find athlete..." 
              value={localSearch}
              onChange={e => {
                setLocalSearch(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  handleSearchResultClick(searchResults[0]);
                }
              }}
              style={{
                width: '180px',
                padding: '4px 30px 4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--neutral-300)',
                background: 'var(--shiro)',
                fontSize: '11px',
                color: 'var(--neutral-900)',
                outline: 'none'
              }}
            />
            {localSearch && (
              <button 
                onClick={() => { setLocalSearch(''); setIsDropdownOpen(false); }}
                style={{ position: 'absolute', right: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                width: '260px',
                background: 'var(--shiro)',
                border: '1px solid var(--neutral-200)',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                zIndex: 100,
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {searchResults.map((res, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleSearchResultClick(res)}
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--neutral-100)',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>{res.athleteName}</div>
                      {res.teamName && (
                        <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', textAlign: 'right', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {res.teamName}
                        </div>
                      )}
                    </div>
                    <div style={{ color: 'var(--neutral-500)', fontSize: '10px' }}>{res.categoryName} • Pool {res.pool}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', height: '28px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => { setIsManualZoom(false); setTimeout(() => fitToScreen(), 0); }}>
            <Maximize size={12} /> Fit
          </button>
          <button type="button" style={{ background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer', color: 'var(--neutral-500)' }} onClick={() => adjustZoom(-0.1)}>
            <MinusCircle size={16} />
          </button>
          <input type="range" min="0.3" max="2" step="0.05" value={zoom} onChange={e => { setIsManualZoom(true); setZoom(parseFloat(e.target.value)); }} style={{ width: '80px', accentColor: 'var(--aka)' }} />
          <button type="button" style={{ background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer', color: 'var(--neutral-500)' }} onClick={() => adjustZoom(0.1)}>
            <PlusCircle size={16} />
          </button>
          <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Bracket Scroll Area */}
      <div className="bv-scroll" ref={viewportRef}>
        <div className="bv-scale-wrapper" style={{ transform: `scale(${zoom})` }}>
          <div className="bv-canvas" ref={canvasRef}>
            {visibleRounds.map((roundMatches, rIdx) => (
              <div key={rIdx} className="bracket-round">
                {roundMatches.map((m: any) => (
                  <div key={m.id} className="match-wrapper">
                    <BracketNode match={m} mats={mats} onPromote={onPromote} isHighlighted={m.id === activeHighlight} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- FullscreenBracketModal: fixed-position popup wrapping BracketViewer + sidebar ---
export default function FullscreenBracketModal({
  categories,
  initialCategoryId,
  highlightMatchId,
  onClose,
  mats = [],
  firstRoundOnly = false,
  onPromote,
  onAssignMat,
}: {
  categories: Array<{ id: string; name: string; matches: any[]; athletes?: any[]; status?: string; mat?: string }>;
  initialCategoryId?: string;
  highlightMatchId?: string | null;
  onClose: () => void;
  mats?: string[];
  firstRoundOnly?: boolean;
  onPromote?: (matchId: string, winnerId: string, nextMatchId: string | null, byeFor?: 'aka' | 'ao') => void;
  onAssignMat?: (categoryId: string, mat: string) => void;
}) {
  const [activeCatId, setActiveCatId] = useState(initialCategoryId || (categories[0]?.id ?? null));
  const activeCatFirstRoundOnly = firstRoundOnly ?? false;
  const activeCategory = categories.find(c => c.id === activeCatId);

  const [modalHighlight, setModalHighlight] = useState<string | null>(highlightMatchId || null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Sync with prop if it changes externally
  useEffect(() => {
    if (highlightMatchId) setModalHighlight(highlightMatchId);
  }, [highlightMatchId]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* FullscreenBracketModal styles */
        .fsb-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: var(--neutral-50);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .fsb-header {
          padding: 12px 20px;
          background: var(--shiro);
          border-bottom: 1px solid var(--neutral-300);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .fsb-title {
          font-family: var(--font-display);
          font-size: 20px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--neutral-900);
        }
        .fsb-close {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--neutral-100);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--neutral-600);
          transition: 0.2s;
        }
        .fsb-close:hover { background: var(--neutral-200); color: var(--aka); }
        
        .fsb-body {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        
        /* Sidebar */
        .fsb-sidebar {
          width: 320px;
          background: var(--shiro);
          border-right: 1px solid var(--neutral-300);
          display: flex;
          flex-direction: column;
          box-shadow: 2px 0 12px rgba(0,0,0,0.03);
          z-index: 10;
        }
        .fsb-sidebar-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--neutral-200);
          font-size: 11px;
          font-weight: 700;
          color: var(--neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .fsb-cat-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .fsb-cat-item {
          padding: 12px 16px;
          border: 1px solid var(--neutral-200);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
          background: var(--shiro);
        }
        .fsb-cat-item:hover {
          border-color: var(--neutral-300);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .fsb-cat-item.active {
          border-color: var(--aka);
          background: var(--neutral-50);
          box-shadow: 0 0 0 1px var(--aka);
        }
        .fsb-cat-name {
          font-weight: 700;
          font-size: 13px;
          color: var(--neutral-900);
          margin-bottom: 6px;
        }
        .fsb-cat-item.active .fsb-cat-name {
          color: var(--aka);
        }
        .fsb-cat-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10px;
          font-weight: 600;
          color: var(--neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .fsb-live-tag { display: flex; align-items: center; gap: 5px; color: var(--status-live); font-weight: 800; }
        .fsb-live-dot { width: 5px; height: 5px; background: var(--status-live); border-radius: 50%; box-shadow: 0 0 6px var(--status-live); animation: pulse 2s infinite; }
        .fsb-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

        /* BracketViewer internal styles */
        .bv-viewport { flex: 1; display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--neutral-100); }
        .bv-controls { padding: 10px 20px; background: var(--shiro); border-bottom: 1px solid var(--neutral-200); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .bv-zoom { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--neutral-500); }
        .bv-scroll {
          flex: 1;
          overflow: auto;
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
          background: oklch(99% 0.002 250);
          background-image: linear-gradient(var(--neutral-100) 1px, transparent 1px), linear-gradient(90deg, var(--neutral-100) 1px, transparent 1px);
          background-size: 40px 40px;
          position: relative;
        }
        /* Scale wrapper: transform-origin top left so scrollbars track content correctly */
        .bv-scale-wrapper {
          display: inline-block;
          transform-origin: top left;
          transition: transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .bv-canvas {
          display: flex;
          gap: 120px;
          padding: var(--space-6);
          align-items: flex-start;
        }

        /* Bracket round */
        .bracket-round { display: flex; flex-direction: column; gap: 60px; min-width: 300px; }
        .round-header {
          font-family: var(--font-display);
          font-size: 20px;
          color: var(--neutral-900);
          text-transform: uppercase;
          letter-spacing: 0.25em;
          text-align: center;
          padding: var(--space-4) 0;
          border-bottom: 4px solid var(--aka);
          margin-bottom: var(--space-2);
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 5;
        }
        .match-wrapper { position: relative; }

        /* Bracket node */
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
        .bracket-node:hover { transform: translateY(-8px) scale(1.02); border-color: var(--neutral-300); box-shadow: 0 32px 64px -16px rgba(0,0,0,0.1), 0 16px 32px -8px rgba(0,0,0,0.06); }
        .bracket-node.live { border: 1px solid var(--status-live); box-shadow: 0 0 0 4px var(--status-live-bg), 0 12px 32px -8px rgba(0,0,0,0.05); }
        .bracket-node.pending { opacity: 0.7; border-style: dashed; background: var(--neutral-50); }
        .bracket-node.pending:hover { transform: none; }
        .bracket-node.completed { border-color: var(--neutral-200); background: oklch(98% 0.005 145); }
        .bracket-node.completed:hover { transform: none; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }

        .live-indicator { position: absolute; top: 14px; right: 18px; display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; color: var(--status-live); text-transform: uppercase; letter-spacing: 0.12em; }
        .live-dot { width: 10px; height: 10px; background: var(--status-live); border-radius: 50%; box-shadow: 0 0 12px var(--status-live); animation: pulse 2s infinite; }
        
        .competitor-row { display: flex; justify-content: space-between; align-items: stretch; padding: 16px 20px; border-bottom: 1px solid var(--neutral-200); position: relative; background: var(--shiro); }
        .competitor-row.loser { background: var(--neutral-100); }
        .competitor-row.loser .comp-name, .competitor-row.loser .comp-team, .competitor-row.loser .comp-score, .competitor-row.loser .metric-tag { color: var(--neutral-400); }
        .competitor-row.winner { background: rgba(16, 185, 129, 0.1); }
        .competitor-row::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }
        .competitor-row.aka::before { background: var(--aka); }
        .competitor-row.ao::before { background: var(--ao); }
        .comp-info { display: flex; flex-direction: column; gap: 4px; }
        .comp-name { font-family: var(--font-display); font-size: 14px; font-weight: 800; color: var(--neutral-900); letter-spacing: 0.05em; }
        .comp-team { font-size: 9px; font-weight: 700; color: var(--neutral-500); text-transform: uppercase; letter-spacing: 0.1em; }
        .metrics-row { display: flex; gap: 4px; margin-top: 6px; }
        .metric-tag { padding: 2px 6px; border-radius: 4px; background: var(--neutral-100); color: var(--neutral-500); font-size: 9px; font-weight: 800; }
        .metric-tag.active-aka { background: var(--aka); color: var(--shiro); }
        .metric-tag.active-ao { background: var(--ao); color: var(--shiro); }
        .comp-score { font-family: var(--font-display); font-size: 24px; font-weight: 800; color: var(--neutral-900); display: flex; align-items: center; padding-left: 16px; }

        /* Match footer */
        .match-footer { padding: 14px 24px; display: flex; align-items: center; gap: 16px; background: oklch(98% 0.002 250); border-top: 1px solid var(--neutral-100); height: 64px; }
        .mat-select-wrapper { flex: 1; position: relative; display: flex; align-items: center; }
        .mat-select { width: 100%; height: 38px; appearance: none; background: var(--shiro); border: 1px solid var(--neutral-200); border-radius: 12px; padding: 0 32px 0 16px; font-family: var(--font-body); font-size: 12px; font-weight: 700; color: var(--neutral-700); cursor: pointer; transition: all 0.2s; }
        .mat-select:hover { border-color: var(--neutral-400); }
        .mat-select-icon { position: absolute; right: 14px; width: 12px; pointer-events: none; color: var(--neutral-400); }
        .btn-promote { width: 38px; height: 38px; background: var(--aka); color: var(--shiro); border: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 12px rgba(217,38,44,0.2); transition: all 0.3s; flex-shrink: 0; }
        .btn-promote:hover { background: var(--aka-hover); transform: scale(1.05); }

        /* Close button */
        .fsb-close { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--neutral-100); border: none; border-radius: 999px; cursor: pointer; transition: all 0.2s; color: var(--neutral-600); }
        .fsb-close:hover { background: var(--neutral-200); color: var(--neutral-900); }

        /* Responsive */
        @media (max-width: 768px) {
          .fsb-body { position: relative; }
          .fsb-sidebar { 
            position: absolute; 
            top: 0; left: 0; bottom: 0; 
            width: 300px; 
            max-width: 85%;
            border-right: 1px solid var(--neutral-300); 
            transform: translateX(-100%); 
            transition: transform 0.3s ease;
            z-index: 1002;
          }
          .fsb-sidebar.open {
            transform: translateX(0);
          }
          .fsb-sidebar-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 1001;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
          }
          .fsb-sidebar-backdrop.open {
            opacity: 1;
            pointer-events: auto;
          }
          .fsb-mobile-toggle {
            display: flex !important;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: none;
            cursor: pointer;
            color: var(--neutral-700);
          }
          .fsb-cat-item.active { transform: none; box-shadow: none; border-color: var(--aka); }
          .fsb-cat-item:hover { transform: none; box-shadow: none; }
          
          .bracket-node { width: 280px; }
          .competitor-row { padding: 16px 16px; min-height: 90px; }
          .comp-score { font-size: 32px; margin-left: 12px; }
          .bv-canvas { gap: 60px; padding: var(--space-3); }
          .bracket-round { gap: 40px; min-width: 280px; }
        }
      `}} />

      <div className="fsb-overlay">
        {/* Modal Header */}
        <div className="fsb-header">
          <div className="fsb-title" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="fsb-mobile-toggle" style={{ display: 'none' }} onClick={() => setShowMobileSidebar(!showMobileSidebar)}>
              {showMobileSidebar ? <X size={20} /> : <Target size={20} />}
            </button>
            Tiesheet — {activeCategory?.name || 'Select Category'}
            {activeCategory && onAssignMat && (
              <select 
                value={activeCategory.mat || ''}
                onChange={(e) => onAssignMat(activeCategory.id, e.target.value)}
                style={{
                  fontSize: '14px', padding: '4px 12px', borderRadius: '8px',
                  border: '1px solid var(--neutral-300)', fontFamily: 'var(--font-body)',
                  letterSpacing: 'normal', textTransform: 'none', background: 'var(--shiro)',
                  color: 'var(--neutral-900)'
                }}
              >
                <option value="">-- Assign Mat --</option>
                {mats.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>
          <button className="fsb-close" onClick={onClose} title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Sidebar + Bracket */}
        <div className="fsb-body">
          <div className={`fsb-sidebar-backdrop ${showMobileSidebar ? 'open' : ''}`} onClick={() => setShowMobileSidebar(false)}></div>
          {/* Category Sidebar */}
          <aside className={`fsb-sidebar ${showMobileSidebar ? 'open' : ''}`}>
            <div className="fsb-sidebar-header">Categories ({categories.length})</div>
            <div className="fsb-cat-list">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className={`fsb-cat-item${activeCatId === cat.id ? ' active' : ''}`}
                  onClick={() => setActiveCatId(cat.id)}
                >
                  <div className="fsb-cat-name">{cat.name}</div>
                  <div className="fsb-cat-meta">
                    {cat.status === 'live' ? (
                      <div className="fsb-live-tag">
                        <div className="fsb-live-dot" />
                        {cat.mat ? `MAT ${cat.mat.padStart(2, '0')}` : 'LIVE'}
                      </div>
                    ) : (
                      <div style={{ color: cat.status === 'completed' ? 'var(--neutral-400)' : 'var(--status-upcoming)' }}>
                        {cat.status === 'completed' ? 'COMPLETED' : (cat.mat ? `MAT ${cat.mat.padStart(2, '0')}` : 'NOT ASSIGNED')}
                      </div>
                    )}
                    <div>{(cat.athletes?.length || cat.matches?.filter((m: any) => m.round === 1 && (m.aka || m.ao)).length * 2 || 0)} ATH</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Bracket Content */}
          <div className="fsb-content">
            {activeCategory ? (
              <BracketViewer
                matches={activeCategory.matches || []}
                categoryName={activeCategory.name}
                mats={mats}
                firstRoundOnly={activeCatFirstRoundOnly}
                highlightMatchId={modalHighlight}
                allCategories={categories}
                onNavigateToMatch={(catId, matchId) => {
                  setActiveCatId(catId);
                  setModalHighlight(matchId);
                }}
                onPromote={onPromote}
              />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-400)' }}>
                Select a category from the sidebar.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
