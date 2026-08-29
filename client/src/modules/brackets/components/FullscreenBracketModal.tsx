'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Search, ZoomIn, ZoomOut, Maximize, Target, LayoutTemplate, Swords, CheckCircle2, ArrowRight, Check, MinusCircle, PlusCircle, RotateCcw } from 'lucide-react';

const METRICS = ['S', 'Y', 'W', 'I', 'C1', 'C2', 'C3', 'HC', 'H'];

// Stable empty array default — prevents new reference on every render (fixes memo breakage)
const EMPTY_MATS: string[] = [];

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
  isKata = false,
  isAdmin = false,
  isEditMode = false,
  onSwapDrop,
  onRevertMatch,
  categoryId = '',
}: {
  match: any;
  mats: string[];
  isHighlighted?: boolean;
  onPromote?: (matchId: string, winnerId: string, nextMatchId: string | null, byeFor?: 'aka' | 'ao') => void;
  isKata?: boolean;
  isAdmin?: boolean;
  isEditMode?: boolean;
  onSwapDrop?: (sourceMatchId: string, sourceSide: 'aka' | 'ao', targetMatchId: string, targetSide: 'aka' | 'ao', sourceCategoryId?: string) => void;
  onRevertMatch?: (matchId: string) => void;
  categoryId?: string;
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

  const handleDragStart = (e: React.DragEvent, side: 'aka' | 'ao') => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ matchId: match.id, side, categoryId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, side: 'aka' | 'ao') => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.matchId && data.side && onSwapDrop) {
        onSwapDrop(data.matchId, data.side, match.id, side, data.categoryId);
      }
    } catch (err) {}
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

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

  const isAkaDraggable = isEditMode && !match.akaFromMatchId && (match.status === 'upcoming' || (match.status === 'completed' && !!match.byeFor));
  const isAoDraggable = isEditMode && !match.aoFromMatchId && (match.status === 'upcoming' || (match.status === 'completed' && !!match.byeFor));

  return (
    <div className={`bracket-node${isLive ? ' live' : ''}${isCompleted ? ' completed' : ''}${isPending ? ' pending' : ''}${isHighlighted ? ' is-highlighted' : ''}`}>
      {isLive && (
        <div className="live-indicator">
          <div className="live-dot" />
          LIVE
        </div>
      )}

      {/* AKA Row */}
      <div 
        className={`competitor-row aka${isCompleted && match.winnerId && match.winnerId !== akaId ? ' loser' : ''}${isCompleted && match.winnerId && match.winnerId === akaId ? ' winner' : ''}${isAkaDraggable ? ' draggable' : ''}`}
        draggable={isAkaDraggable}
        onDragStart={(e) => isAkaDraggable && handleDragStart(e, 'aka')}
        onDrop={(e) => isAkaDraggable && handleDrop(e, 'aka')}
        onDragOver={(e) => isAkaDraggable && handleDragOver(e)}
        style={isAkaDraggable ? { cursor: 'grab' } : {}}
      >
        <div className="comp-info">
          <div className="comp-name">
            {match.aka ? (match.aka.name || '').toUpperCase() : (
              match.akaFromMatchId ? <span style={{ color: 'var(--neutral-400)', fontStyle: 'normal' }}>WINNER M{match.akaFromMatchId}</span> : <span style={{ color: 'var(--neutral-400)' }}>No player assigned</span>
            )}
          </div>
          {match.aka && (
            <div className="comp-team">
              {[match.aka.academy, match.aka.state || match.aka.country].filter(Boolean).join(' • ').toUpperCase()}
            </div>
          )}
          {match.aka && (
            <div className="metrics-row">
              {isKata ? (
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--neutral-500)', padding: '4px 10px', background: 'var(--neutral-50)', borderRadius: '6px', marginTop: '4px', width: 'fit-content' }}>
                  {match.selectedKata?.aka?.name ? (
                    <>Kata: <span style={{ color: 'var(--aka)', fontWeight: 700 }}>{match.selectedKata.aka.name}</span></>
                  ) : (
                    <span style={{ color: 'var(--neutral-400)' }}>&mdash;</span>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {match.akaIppon > 0 && <span className="stat-chip">I:{match.akaIppon}</span>}
                  {match.akaWazaari > 0 && <span className="stat-chip">W:{match.akaWazaari}</span>}
                  {match.akaYuko > 0 && <span className="stat-chip">Y:{match.akaYuko}</span>}
                  {match.akaSenshu && <span className="stat-chip" style={{ background: '#fef3c7', color: '#b45309' }}>SENSHU</span>}
                  {match.akaC1 > 0 && <span className="stat-chip" style={{ background: '#fee2e2', color: '#dc2626' }}>C1:{match.akaC1}</span>}
                  {match.akaC2 > 0 && <span className="stat-chip" style={{ background: '#fee2e2', color: '#dc2626' }}>C2:{match.akaC2}</span>}
                  {!match.akaIppon && !match.akaWazaari && !match.akaYuko && !match.akaSenshu && !match.akaC1 && !match.akaC2 && (
                    METRICS.map(m => (
                      <React.Fragment key={m}>
                        <MetricTag label={m} isAo={false} />
                        {m === 'I' && <div style={{ width: 16 }} />}
                      </React.Fragment>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="comp-score">{(match.akaScore !== undefined && match.akaScore !== null && match.akaScore !== '') ? match.akaScore : ''}</div>
      </div>

      {/* AO Row */}
      <div 
        className={`competitor-row ao${isCompleted && match.winnerId && match.winnerId !== aoId ? ' loser' : ''}${isCompleted && match.winnerId && match.winnerId === aoId ? ' winner' : ''}${isAoDraggable ? ' draggable' : ''}`}
        draggable={isAoDraggable}
        onDragStart={(e) => isAoDraggable && handleDragStart(e, 'ao')}
        onDrop={(e) => isAoDraggable && handleDrop(e, 'ao')}
        onDragOver={(e) => isAoDraggable && handleDragOver(e)}
        style={isAoDraggable ? { cursor: 'grab' } : {}}
      >
        <div className="comp-info">
          <div className="comp-name">
            {match.ao ? (match.ao.name || '').toUpperCase() : (
              match.aoFromMatchId ? <span style={{ color: 'var(--neutral-400)', fontStyle: 'normal' }}>WINNER M{match.aoFromMatchId}</span> : <span style={{ color: 'var(--neutral-400)' }}>No player assigned</span>
            )}
          </div>
          {match.ao && (
            <div className="comp-team">
              {[match.ao.academy, match.ao.state || match.ao.country].filter(Boolean).join(' • ').toUpperCase()}
            </div>
          )}
          {match.ao && (
            <div className="metrics-row">
              {isKata ? (
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--neutral-500)', padding: '4px 10px', background: 'var(--neutral-50)', borderRadius: '6px', marginTop: '4px', width: 'fit-content' }}>
                  {match.selectedKata?.ao?.name ? (
                    <>Kata: <span style={{ color: 'var(--ao)', fontWeight: 700 }}>{match.selectedKata.ao.name}</span></>
                  ) : (
                    <span style={{ color: 'var(--neutral-400)' }}>&mdash;</span>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {match.aoIppon > 0 && <span className="stat-chip">I:{match.aoIppon}</span>}
                  {match.aoWazaari > 0 && <span className="stat-chip">W:{match.aoWazaari}</span>}
                  {match.aoYuko > 0 && <span className="stat-chip">Y:{match.aoYuko}</span>}
                  {match.aoSenshu && <span className="stat-chip" style={{ background: '#fef3c7', color: '#b45309' }}>SENSHU</span>}
                  {match.aoC1 > 0 && <span className="stat-chip" style={{ background: '#fee2e2', color: '#dc2626' }}>C1:{match.aoC1}</span>}
                  {match.aoC2 > 0 && <span className="stat-chip" style={{ background: '#fee2e2', color: '#dc2626' }}>C2:{match.aoC2}</span>}
                  {!match.aoIppon && !match.aoWazaari && !match.aoYuko && !match.aoSenshu && !match.aoC1 && !match.aoC2 && (
                    METRICS.map(m => (
                      <React.Fragment key={m}>
                        <MetricTag label={m} isAo={true} />
                        {m === 'I' && <div style={{ width: 16 }} />}
                      </React.Fragment>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="comp-score">{(match.aoScore !== undefined && match.aoScore !== null && match.aoScore !== '') ? match.aoScore : ''}</div>
      </div>

      {/* Match Footer */}
      <div className="match-footer" style={{ position: 'relative' }}>
        {isPending ? (
          <div className="text-micro" style={{ flex: 1, color: 'var(--neutral-400)', fontWeight: 700, letterSpacing: '0.1em' }}>
            PENDING QUALIFICATION
          </div>
        ) : (
          <>
            <div className="text-micro" style={{ flex: 1, color: 'var(--neutral-400)', fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isCompleted ? (
                <>
                  <span style={{ color: 'var(--status-live)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={11} /> COMPLETED {match.byeFor ? `(${match.byeFor.toUpperCase()} BYE)` : ''}
                  </span>
                  {isAdmin && onRevertMatch && (
                    <button 
                      type="button"
                      title="Revert Match"
                      onClick={() => {
                        if (confirm('Are you sure you want to revert this match? This will clear the winner and reset it to upcoming.')) {
                          onRevertMatch(match.id);
                        }
                      }}
                      style={{ 
                        background: 'transparent', border: 'none', padding: '2px', cursor: 'pointer', 
                        color: 'var(--neutral-400)', display: 'flex', alignItems: 'center', borderRadius: '4px' 
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--status-live)'; e.currentTarget.style.background = 'var(--status-live-bg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--neutral-400)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </>
              ) : `MATCH ${match.matchNumber}`}
            </div>
            {isAdmin && onPromote && !isCompleted && (
              <div style={{ position: 'relative' }}>
                <button type="button"
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
                      <button type="button"
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
                      <button type="button"
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
                      <button type="button"
                        onClick={() => { onPromote(match.id, akaId, match.nextMatchId, 'ao'); setShowPromoteMenu(false); }}
                        style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--neutral-500)', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--neutral-50)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        AKA wins by BYE (AO absent/DQ)
                      </button>
                    )}
                    {hasAo && (
                      <button type="button"
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
                <CheckCircle2 size={12} style={{ display: 'inline-block', verticalAlign: 'baseline', marginRight: '4px' }} /> Advanced
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

import { useAuth } from '@/modules/auth/components/AuthProvider';

// --- BracketViewer: the zoomable bracket canvas ---
export function BracketViewer({
  matches,
  categoryName,
  isKata,
  mats = EMPTY_MATS,
  firstRoundOnly = false,
  highlightMatchId,
  allCategories,
  onNavigateToMatch,
  onPromote,
  isEditMode = false,
  onSwapDrop,
  onRevertMatch,
  categoryId = '',
}: {
  matches: any[];
  categoryName?: string;
  isKata?: boolean;
  mats?: string[];
  firstRoundOnly?: boolean;
  highlightMatchId?: string | null;
  allCategories?: any[];
  onNavigateToMatch?: (categoryId: string, matchId: string) => void;
  onPromote?: (matchId: string, winnerId: string, nextMatchId: string | null, byeFor?: 'aka' | 'ao') => void;
  isEditMode?: boolean;
  onSwapDrop?: (sourceMatchId: string, sourceSide: 'aka' | 'ao', targetMatchId: string, targetSide: 'aka' | 'ao', sourceCategoryId?: string) => void;
  onRevertMatch?: (matchId: string) => void;
  categoryId?: string;
}) {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const availablePools = Array.from(new Set((matches || []).filter(m => m.id.startsWith('Pool')).map(m => m.id.split('-')[0].replace('Pool', '')))).sort((a, b) => parseInt(a) - parseInt(b));
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [showPoolDropdown, setShowPoolDropdown] = useState(false);
  const poolDragHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
            athleteName: akaMatch ? akaName : (aoMatch ? aoName : (akaName || aoName || 'Empty')),
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

  const [prevActiveHighlight, setPrevActiveHighlight] = useState(activeHighlight);
  const poolsKey = availablePools.join(',');
  const [prevPoolsKey, setPrevPoolsKey] = useState(poolsKey);

  // Auto-select the first available pool (or switch when highlight changes)
  useEffect(() => {
    if (availablePools.length === 0) return;
    if (activeHighlight && activeHighlight.startsWith('Pool')) {
      const highlightPool = activeHighlight.split('-')[0].replace('Pool', '');
      if (availablePools.includes(highlightPool)) {
        setSelectedPool(highlightPool);
        return;
      }
    }
    // Default: select pool 1 (or first available)
    setSelectedPool(prev => (prev && availablePools.includes(prev)) ? prev : availablePools[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolsKey, activeHighlight]);

  const filteredMatches = (availablePools.length > 0 && selectedPool)
    ? (matches || []).filter(m => m.id.startsWith(`Pool${selectedPool}-`))
    : (matches || []);

  const [zoom, setZoom] = useState(1);
  const [isManualZoom, setIsManualZoom] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [connectors, setConnectors] = useState<Array<{x1:number;y1:number;x2:number;y2:number;xMid:number}>>([]);

  // Reset manual zoom when category changes (render-phase state adjustment)
  const [prevCategoryName, setPrevCategoryName] = useState(categoryName);
  if (categoryName !== prevCategoryName) {
    setPrevCategoryName(categoryName);
    setIsManualZoom(false);
  }

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
    
    // Scale to fit the bounding box
    const scale = Math.max(0.2, Math.min(2.0, Math.min(vW / cW, vH / cH)));
    
    // Eliminate blank space by dynamically expanding the flex container
    // to exactly match the scaled viewport dimensions
    canvasRef.current.style.minWidth = `${vW / scale}px`;
    canvasRef.current.style.minHeight = `${vH / scale}px`;
    
    setZoom(scale);
  }, [isManualZoom]);

  // Store fitToScreen in a ref so the resize listener doesn't re-subscribe every render
  const fitToScreenRef = useRef(fitToScreen);
  useEffect(() => {
    fitToScreenRef.current = fitToScreen;
  }, [fitToScreen]);
  useEffect(() => {
    const stableFit = () => fitToScreenRef.current();
    const t = setTimeout(stableFit, 200);
    window.addEventListener('resize', stableFit);
    return () => { clearTimeout(t); window.removeEventListener('resize', stableFit); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMatches]); // intentionally omits fitToScreen — handled via ref above

  // Pinch-to-zoom for mobile
  const lastTouchDistance = useRef<number | null>(null);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault(); // Prevent default scroll when pinching
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDistance.current = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance.current !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        
        const delta = (dist - lastTouchDistance.current) * 0.005;
        lastTouchDistance.current = dist;
        setIsManualZoom(true);
        setZoom(prev => Math.max(0.3, Math.min(2, +(prev + delta).toFixed(3))));
      }
    };

    const onTouchEnd = () => {
      lastTouchDistance.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // Group matches by round
  const roundMap = new Map<number, any[]>();
  filteredMatches.forEach(m => {
    if (!roundMap.has(m.round)) roundMap.set(m.round, []);
    roundMap.get(m.round)!.push(m);
  });
  const rounds = Array.from(roundMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, ms]) => ms.sort((a: any, b: any) => a.matchNumber - b.matchNumber));

  // ── SVG Connector Computation ──
  const computeConnectors = useCallback(() => {
    if (!canvasRef.current || rounds.length < 2) {
      setConnectors([]);
      return;
    }
    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    const wrappers = canvas.querySelectorAll('.match-wrapper');
    if (!wrappers.length) { setConnectors([]); return; }

    // Build a map of matchId -> DOM element center-right / center-left
    const nodeMap = new Map<string, HTMLElement>();
    wrappers.forEach((el) => {
      const node = el.querySelector('.bracket-node') as HTMLElement;
      if (!node) return;
      const matchId = (el as any).__matchId;
      if (matchId) nodeMap.set(matchId, node);
    });

    const newConnectors: Array<{x1:number;y1:number;x2:number;y2:number;xMid:number}> = [];
    const allMatches = filteredMatches;

    for (const match of allMatches) {
      if (!match.nextMatchId) continue;
      const srcNode = nodeMap.get(match.id);
      const destNode = nodeMap.get(match.nextMatchId);
      if (!srcNode || !destNode) continue;
      
      const srcRect = srcNode.getBoundingClientRect();
      const destRect = destNode.getBoundingClientRect();

      // Find the specific row to connect to
      const nextMatch = allMatches.find(m => m.id === match.nextMatchId);
      const isAka = nextMatch?.akaFromMatchId === match.id;
      const isAo = nextMatch?.aoFromMatchId === match.id;
      
      const destAka = destNode.querySelector('.competitor-row.aka');
      const destAo = destNode.querySelector('.competitor-row.ao');
      const destRow = isAka ? destAka : isAo ? destAo : destNode;
      const destRowRect = destRow ? destRow.getBoundingClientRect() : destRect;

      const x1 = (srcRect.right - canvasRect.left) / zoom;
      const y1 = (srcRect.top + srcRect.height / 2 - canvasRect.top) / zoom;
      const x2 = (destRect.left - canvasRect.left) / zoom;
      const y2 = (destRowRect.top + destRowRect.height / 2 - canvasRect.top) / zoom;
      const xMid = x1 + (x2 - x1) / 2;

      newConnectors.push({ x1, y1, x2, y2, xMid });
    }
    setConnectors(newConnectors);
  }, [filteredMatches, rounds.length, zoom]);

  useEffect(() => {
    const timer = setTimeout(computeConnectors, 300);
    return () => clearTimeout(timer);
  }, [computeConnectors, zoom, filteredMatches]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(() => {
      setTimeout(computeConnectors, 100);
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [computeConnectors]);

  const visibleRounds = firstRoundOnly ? (rounds.length > 0 ? [rounds[0]] : []) : rounds;

  if (!matches || matches.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-400)', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '48px', color: 'var(--neutral-300)' }}><Swords size={48} strokeWidth={1.5} color="currentColor" /></div>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>No matches generated yet.</div>
      </div>
    );
  }

  return (
    <div className="bv-viewport">
      <div className="bv-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '18px', margin: 0 }}>{categoryName || 'Tiesheet'}</h2>
          
          {availablePools.length > 0 && (
            <div 
              style={{ position: 'relative' }}
              onMouseLeave={() => setShowPoolDropdown(false)}
            >
              <button
                type="button"
                className="pool-select"
                onClick={() => setShowPoolDropdown(prev => !prev)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setShowPoolDropdown(true);
                }}
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--neutral-200)', 
                  background: 'var(--shiro)', 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: 'var(--neutral-800)', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Pool {selectedPool || availablePools[0]}
                <span style={{ fontSize: '10px', color: 'var(--neutral-500)' }}>▼</span>
              </button>

              {showPoolDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: 'var(--shiro)',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    minWidth: '120px',
                    overflowY: 'auto',
                    maxHeight: '300px'
                  }}
                >
                  {availablePools.map(p => (
                    <div
                      key={p}
                      onClick={() => {
                        setSelectedPool(p);
                        setShowPoolDropdown(false);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (p !== selectedPool && !poolDragHoverTimeoutRef.current) {
                          poolDragHoverTimeoutRef.current = setTimeout(() => {
                            setSelectedPool(p);
                            poolDragHoverTimeoutRef.current = null;
                          }, 500);
                        }
                      }}
                      onDragLeave={() => {
                        if (poolDragHoverTimeoutRef.current) {
                          clearTimeout(poolDragHoverTimeoutRef.current);
                          poolDragHoverTimeoutRef.current = null;
                        }
                      }}
                      onDrop={() => {
                        if (poolDragHoverTimeoutRef.current) {
                          clearTimeout(poolDragHoverTimeoutRef.current);
                          poolDragHoverTimeoutRef.current = null;
                        }
                        setShowPoolDropdown(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '13px',
                        fontWeight: selectedPool === p ? 700 : 500,
                        color: selectedPool === p ? 'var(--neutral-900)' : 'var(--neutral-600)',
                        background: selectedPool === p ? 'var(--neutral-50)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'var(--neutral-50)';
                      }}
                      onMouseLeave={e => {
                        if (selectedPool !== p) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Pool {p}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              onChange={e => { setLocalSearch(e.target.value); setIsDropdownOpen(true); }}
              onFocus={() => setIsDropdownOpen(true)}
              onKeyDown={e => { if (e.key === 'Enter' && searchResults.length > 0) handleSearchResultClick(searchResults[0]); }}
              style={{ width: '180px', padding: '4px 30px 4px 10px', borderRadius: '6px', border: '1px solid var(--neutral-300)', background: 'var(--shiro)', fontSize: '11px', color: 'var(--neutral-900)', outline: 'none' }}
            />
            {localSearch && (
              <button type="button" 
                onClick={() => { setLocalSearch(''); setIsDropdownOpen(false); }}
                style={{ position: 'absolute', right: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: '260px', background: 'var(--shiro)', border: '1px solid var(--neutral-200)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '300px', overflowY: 'auto' }}>
                {searchResults.map((res, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleSearchResultClick(res)}
                    style={{ padding: '8px 12px', borderBottom: '1px solid var(--neutral-100)', cursor: 'pointer', fontSize: '11px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>{res.athleteName}</div>
                      {res.teamName && (
                        <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', textAlign: 'right', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.teamName}</div>
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

      <div className="bv-scroll" ref={viewportRef}>
        <div className="bv-scale-wrapper" style={{ transform: `scale(${zoom})` }}>
          <div className="bv-canvas" ref={canvasRef}>
            {connectors.length > 0 && (
              <svg className="bv-connectors" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                {connectors.map((c, i) => (
                  <path
                    key={i}
                    d={`M${c.x1},${c.y1} L${c.xMid},${c.y1} L${c.xMid},${c.y2} L${c.x2},${c.y2}`}
                    fill="none"
                    style={{ fill: 'none', fillOpacity: 0 }}
                    stroke="var(--neutral-300)"
                    strokeWidth="2"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                  />
                ))}
              </svg>
            )}
            {visibleRounds.map((roundMatches, rIdx) => (
              <div key={rIdx} className="bracket-round">
                {roundMatches.map((m: any) => (
                  <div key={m.id} className="match-wrapper" ref={(el) => { if (el) (el as any).__matchId = m.id; }}>
                    <BracketNode 
                      match={m} 
                      mats={mats} 
                      categoryId={categoryId}
                      onPromote={onPromote} 
                      isHighlighted={m.id === activeHighlight} 
                      isKata={isKata} 
                      isAdmin={isAdmin} 
                      isEditMode={isEditMode}
                      onSwapDrop={onSwapDrop}
                      onRevertMatch={onRevertMatch}
                    />
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

export default function FullscreenBracketModal({
  categories,
  initialCategoryId,
  highlightMatchId,
  onClose,
  mats = EMPTY_MATS,
  firstRoundOnly = false,
  onPromote,
  onAssignMat,
  isAdmin = false,
  onSwapDrop,
  onRevertMatch,
}: {
  categories: Array<{ id: string; name: string; matches: any[]; isKata?: boolean; athletes?: any[]; status?: string; mat?: string }>;
  initialCategoryId?: string;
  highlightMatchId?: string | null;
  onClose: () => void;
  mats?: string[];
  firstRoundOnly?: boolean;
  onPromote?: (matchId: string, winnerId: string, nextMatchId: string | null, byeFor?: 'aka' | 'ao') => void;
  onAssignMat?: (categoryId: string, mat: string) => void;
  isAdmin?: boolean;
  onSwapDrop?: (
    categoryId: string, 
    sourceMatchId: string, 
    sourceSide: 'aka' | 'ao', 
    targetMatchId: string, 
    targetSide: 'aka' | 'ao',
    targetCategoryId?: string,
    action?: 'swap' | 'move'
  ) => void;
  onRevertMatch?: (categoryId: string, matchId: string) => void;
}) {
  const activeCatIdState = initialCategoryId || (categories[0]?.id ?? null);
  const [activeCatId, setActiveCatId] = useState(activeCatIdState);
  const activeCategory = categories.find(c => c.id === activeCatId);
  const activeCatFirstRoundOnly = firstRoundOnly ?? false;

  const isKataCat = activeCategory?.isKata || activeCategory?.name?.toLowerCase().includes('kata') || false;

  const [modalHighlight, setModalHighlight] = useState<string | null>(highlightMatchId || null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const dragHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [crossCategoryPrompt, setCrossCategoryPrompt] = useState<{
    srcAthlete: any;
    tgtAthlete: any;
    srcCatName: string;
    tgtCatName: string;
    onConfirmSwap: () => void;
    onConfirmMove: () => void;
  } | null>(null);

  const [sbFilterDiscipline, setSbFilterDiscipline] = useState<'all'|'kata'|'kumite'>('all');
  const [sbFilterGender, setSbFilterGender] = useState<'all'|'male'|'female'>('all');
  const [sbFilterMat, setSbFilterMat] = useState<string>('all');

  // Derive list of mats actually assigned across all categories
  const assignedMats = Array.from(new Set(categories.map(c => c.mat).filter(Boolean) as string[])).sort();

  const filteredSidebarCats = categories.filter(cat => {
    const lower = cat.name.toLowerCase();
    const isKata = lower.endsWith('kata') || lower.includes(' kata ');
    if (sbFilterDiscipline === 'kata' && !isKata) return false;
    if (sbFilterDiscipline === 'kumite' && isKata) return false;
    if (sbFilterGender === 'female' && !lower.includes('female')) return false;
    if (sbFilterGender === 'male' && (!lower.includes('male') || lower.includes('female'))) return false;
    if (sbFilterMat !== 'all' && cat.mat !== sbFilterMat) return false;
    return true;
  });

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
          padding: 12px 16px 0;
          border-bottom: 1px solid var(--neutral-200);
        }
        .fsb-sidebar-title {
          font-size: 10px;
          font-weight: 800;
          color: var(--neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .fsb-filter-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          padding-bottom: 10px;
        }
        .fsb-filter-chip {
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid var(--neutral-200);
          background: var(--shiro);
          font-size: 10px;
          font-weight: 700;
          color: var(--neutral-600);
          cursor: pointer;
          transition: background 150ms var(--ease-out), border-color 150ms var(--ease-out), color 150ms var(--ease-out);
          white-space: nowrap;
        }
        .fsb-filter-chip:hover { border-color: var(--neutral-400); }
        .fsb-filter-chip.active-kata { background: #eff6ff; border-color: #1d4ed8; color: #1d4ed8; }
        .fsb-filter-chip.active-kumite { background: #fff1f2; border-color: var(--aka); color: var(--aka); }
        .fsb-filter-chip.active-gender { background: var(--neutral-900); border-color: var(--neutral-900); color: var(--shiro); }
        .fsb-filter-chip.active-mat { background: oklch(94% 0.04 145); border-color: oklch(60% 0.12 145); color: oklch(35% 0.12 145); }
        .fsb-filter-sep { width: 1px; background: var(--neutral-200); margin: 2px 0; align-self: stretch; flex-shrink: 0; }
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
          transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1), border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out);
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
          justify-content: space-between;
          padding: 48px;
          align-items: stretch;
          position: relative;
        }

        /* Bracket round */
        .bracket-round { 
          display: flex; 
          flex-direction: column; 
          justify-content: space-around; 
          min-width: 320px; 
          position: relative; 
          flex: 1; 
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
          margin-bottom: var(--space-2);
          background: var(--shiro);
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
          transition: transform 300ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 300ms cubic-bezier(0.23, 1, 0.32, 1), border-color 300ms cubic-bezier(0.23, 1, 0.32, 1);
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
        .stat-chip { display: inline-flex; align-items: center; gap: 2px; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; background: var(--neutral-100); color: var(--neutral-600); }
        .comp-score { font-family: var(--font-display); font-size: 24px; font-weight: 800; color: var(--neutral-900); display: flex; align-items: center; padding-left: 16px; }

        /* Match footer */
        .match-footer { padding: 14px 24px; display: flex; align-items: center; gap: 16px; background: oklch(98% 0.002 250); border-top: 1px solid var(--neutral-100); height: 64px; }
        .mat-select-wrapper { flex: 1; position: relative; display: flex; align-items: center; }
        .mat-select { width: 100%; height: 38px; appearance: none; background: var(--shiro); border: 1px solid var(--neutral-200); border-radius: 12px; padding: 0 32px 0 16px; font-family: var(--font-body); font-size: 12px; font-weight: 700; color: var(--neutral-700); cursor: pointer; transition: border-color 200ms var(--ease-out); }
        .mat-select:hover { border-color: var(--neutral-400); }
        .mat-select-icon { position: absolute; right: 14px; width: 12px; pointer-events: none; color: var(--neutral-400); }
        .btn-promote { width: 38px; height: 38px; background: var(--aka); color: var(--shiro); border: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 12px rgba(217,38,44,0.2); transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), background 200ms var(--ease-out); flex-shrink: 0; }
        .btn-promote:hover { background: var(--aka-hover); transform: translateY(-2px) scale(1.02); }
        .btn-promote:active { transform: scale(0.97); }

        /* Close button */
        .fsb-close { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--neutral-100); border: none; border-radius: 999px; cursor: pointer; transition: background 150ms var(--ease-out), color 150ms var(--ease-out), transform 150ms linear; color: var(--neutral-600); }
        .fsb-close:hover { background: var(--neutral-200); color: var(--neutral-900); }
        .fsb-close:active { transform: scale(0.97); }

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
          
          .bracket-node { width: 240px; }
          .competitor-row { padding: 12px 12px; min-height: 70px; }
          .comp-score { font-size: 24px; margin-left: 10px; }
          .bv-canvas { gap: 60px; padding: var(--space-3); }
          .bracket-round { gap: 40px; min-width: 240px; }
        }
      `}} />

      <div className="fsb-overlay">
        {/* Modal Header */}
        <div className="fsb-header">
          <div className="fsb-title" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button type="button" className="fsb-mobile-toggle" style={{ display: 'none' }} onClick={() => setShowMobileSidebar(!showMobileSidebar)}>
              {showMobileSidebar ? <X size={20} /> : <Target size={20} />}
            </button>
            Tiesheet — {activeCategory?.name || 'Select Category'}
            {isAdmin && activeCategory && onAssignMat && (
              <select 
                className="fsb-mat-select"
                value={activeCategory.mat || ''}
                onChange={(e) => onAssignMat(activeCategory.id, e.target.value)}
                title="Assign Mat"
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
            {isAdmin && (
              <button 
                type="button" 
                onClick={() => setIsEditMode(!isEditMode)}
                style={{
                  fontSize: '12px', padding: '6px 12px', borderRadius: '8px',
                  border: isEditMode ? '1px solid var(--aka)' : '1px solid var(--neutral-300)', 
                  background: isEditMode ? 'var(--aka-light)' : 'var(--shiro)',
                  color: isEditMode ? 'var(--aka)' : 'var(--neutral-700)',
                  fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {isEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
              </button>
            )}
          </div>
          <button type="button" className="fsb-close" onClick={onClose} title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Sidebar + Bracket */}
        <div className="fsb-body">
          <div className={`fsb-sidebar-backdrop ${showMobileSidebar ? 'open' : ''}`} onClick={() => setShowMobileSidebar(false)}></div>
          {/* Category Sidebar */}
          <aside className={`fsb-sidebar ${showMobileSidebar ? 'open' : ''}`}>
            <div className="fsb-sidebar-header">
              <div className="fsb-sidebar-title">
                <span>Categories ({filteredSidebarCats.length}/{categories.length})</span>
                {(sbFilterDiscipline !== 'all' || sbFilterGender !== 'all' || sbFilterMat !== 'all') && (
                  <button type="button"
                    onClick={() => { setSbFilterDiscipline('all'); setSbFilterGender('all'); setSbFilterMat('all'); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', fontWeight: 700, color: 'var(--aka)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: 0 }}
                  >Clear</button>
                )}
              </div>

              {/* Discipline filter */}
              <div className="fsb-filter-row">
                <button type="button"
                  className={`fsb-filter-chip${sbFilterDiscipline === 'kata' ? ' active-kata' : ''}`}
                  onClick={() => setSbFilterDiscipline(sbFilterDiscipline === 'kata' ? 'all' : 'kata')}
                >Kata</button>
                <button type="button"
                  className={`fsb-filter-chip${sbFilterDiscipline === 'kumite' ? ' active-kumite' : ''}`}
                  onClick={() => setSbFilterDiscipline(sbFilterDiscipline === 'kumite' ? 'all' : 'kumite')}
                >Kumite</button>

                <div className="fsb-filter-sep" />

                {/* Gender filter */}
                <button type="button"
                  className={`fsb-filter-chip${sbFilterGender === 'male' ? ' active-gender' : ''}`}
                  onClick={() => setSbFilterGender(sbFilterGender === 'male' ? 'all' : 'male')}
                >Male</button>
                <button type="button"
                  className={`fsb-filter-chip${sbFilterGender === 'female' ? ' active-gender' : ''}`}
                  onClick={() => setSbFilterGender(sbFilterGender === 'female' ? 'all' : 'female')}
                >Female</button>
              </div>

              {/* Mat filter — only shown if any mats are assigned */}
              {assignedMats.length > 0 && (
                <div className="fsb-filter-row" style={{ paddingTop: 0 }}>
                  {assignedMats.map(mat => (
                    <button type="button"
                      key={mat}
                      className={`fsb-filter-chip${sbFilterMat === mat ? ' active-mat' : ''}`}
                      onClick={() => setSbFilterMat(sbFilterMat === mat ? 'all' : mat)}
                    >{mat}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="fsb-cat-list">
              {filteredSidebarCats.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--neutral-400)', fontSize: '12px', fontWeight: 600 }}>
                  No categories match filters
                </div>
              ) : filteredSidebarCats.map(cat => (
                <div
                  key={cat.id}
                  className={`fsb-cat-item${activeCatId === cat.id ? ' active' : ''}`}
                  onClick={() => { setActiveCatId(cat.id); setShowMobileSidebar(false); }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (cat.id !== activeCatId && !dragHoverTimeoutRef.current) {
                      dragHoverTimeoutRef.current = setTimeout(() => {
                        setActiveCatId(cat.id);
                        dragHoverTimeoutRef.current = null;
                      }, 500);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragHoverTimeoutRef.current) {
                      clearTimeout(dragHoverTimeoutRef.current);
                      dragHoverTimeoutRef.current = null;
                    }
                  }}
                  onDrop={() => {
                    if (dragHoverTimeoutRef.current) {
                      clearTimeout(dragHoverTimeoutRef.current);
                      dragHoverTimeoutRef.current = null;
                    }
                  }}
                >
                  <div className="fsb-cat-name">{cat.name}</div>
                  <div className="fsb-cat-meta">
                    {cat.status === 'live' ? (
                      <div className="fsb-live-tag">
                        <div className="fsb-live-dot" />
                        {cat.mat ? cat.mat : 'LIVE'}
                      </div>
                    ) : (
                      <div style={{ color: cat.status === 'completed' ? 'var(--neutral-400)' : 'var(--status-upcoming)' }}>
                        {cat.status === 'completed' ? 'COMPLETED' : (cat.mat ? cat.mat : 'NOT ASSIGNED')}
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
                isKata={isKataCat}
                mats={mats}
                firstRoundOnly={activeCatFirstRoundOnly}
                highlightMatchId={modalHighlight}
                allCategories={categories}
                onNavigateToMatch={(catId, matchId) => {
                  setActiveCatId(catId);
                  setModalHighlight(matchId);
                }}
                onPromote={onPromote}
                isEditMode={isEditMode}
                categoryId={activeCategory.id}
                onSwapDrop={async (srcMatchId, srcSide, tgtMatchId, tgtSide, srcCategoryId) => {
                  if (onSwapDrop && activeCategory && srcCategoryId) {
                    if (srcCategoryId !== activeCategory.id) {
                      // Cross-category swap or move
                      const srcCatName = categories.find(c => c.id === srcCategoryId)?.name || 'Source Category';
                      const tgtCatName = activeCategory.name;

                      const srcMatch = categories.find(c => c.id === srcCategoryId)?.matches?.find((m: any) => m.id === srcMatchId);
                      const tgtMatch = activeCategory.matches?.find((m: any) => m.id === tgtMatchId);

                      const srcAthlete = srcMatch ? srcMatch[srcSide] : null;
                      const tgtAthlete = tgtMatch ? tgtMatch[tgtSide] : null;

                      if (!srcAthlete) return;

                      if (tgtAthlete) {
                        setCrossCategoryPrompt({
                          srcAthlete,
                          tgtAthlete,
                          srcCatName,
                          tgtCatName,
                          onConfirmSwap: () => onSwapDrop(srcCategoryId, srcMatchId, srcSide, tgtMatchId, tgtSide, activeCategory.id, 'swap'),
                          onConfirmMove: () => onSwapDrop(srcCategoryId, srcMatchId, srcSide, tgtMatchId, tgtSide, activeCategory.id, 'move'),
                        });
                      } else {
                        const confirmMove = window.confirm(
                          `Are you sure you want to move ${srcAthlete.name} from ${srcCatName} to ${tgtCatName}?`
                        );
                        if (confirmMove) {
                          onSwapDrop(srcCategoryId, srcMatchId, srcSide, tgtMatchId, tgtSide, activeCategory.id, 'move');
                        }
                      }
                    } else {
                      // Same category
                      onSwapDrop(srcCategoryId, srcMatchId, srcSide, tgtMatchId, tgtSide);
                    }
                  }
                }}
                onRevertMatch={(matchId) => {
                  if (onRevertMatch && activeCategory) {
                    onRevertMatch(activeCategory.id, matchId);
                  }
                }}
              />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-400)' }}>
                Select a category from the sidebar.
              </div>
            )}
          </div>
        </div>
      </div>

      {crossCategoryPrompt && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div 
            style={{
              background: 'var(--shiro)',
              width: '100%',
              maxWidth: '480px',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid var(--neutral-200)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fsb-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ padding: '24px 24px 16px 24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--neutral-900)', margin: '0 0 12px 0' }}>
                Cross-Category Transfer
              </h3>
              <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--neutral-600)', margin: 0 }}>
                You dragged <strong>{crossCategoryPrompt.srcAthlete.name}</strong> from <em>{crossCategoryPrompt.srcCatName}</em> onto <strong>{crossCategoryPrompt.tgtAthlete.name}</strong> in <em>{crossCategoryPrompt.tgtCatName}</em>.
              </p>
              <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--neutral-500)', margin: '12px 0 0 0', padding: '10px 12px', background: 'var(--neutral-50)', borderRadius: '8px', border: '1px solid var(--neutral-200)' }}>
                <strong>Force Add</strong> moves {crossCategoryPrompt.srcAthlete.name} to {crossCategoryPrompt.tgtCatName} (which might rebuild the bracket / increase pool size), while keeping {crossCategoryPrompt.tgtAthlete.name} there.
              </p>
            </div>
            
            <div 
              style={{ 
                padding: '16px 24px 24px 24px', 
                display: 'flex', 
                flexDirection: 'column',
                gap: '8px',
                borderTop: '1px solid var(--neutral-100)',
                background: 'var(--shiro)'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  crossCategoryPrompt.onConfirmSwap();
                  setCrossCategoryPrompt(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--neutral-200)',
                  background: 'var(--shiro)',
                  color: 'var(--neutral-800)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--neutral-50)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--shiro)')}
              >
                Swap Athletes Between Categories
              </button>
              
              <button
                type="button"
                onClick={() => {
                  crossCategoryPrompt.onConfirmMove();
                  setCrossCategoryPrompt(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--neutral-900)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--neutral-800)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--neutral-900)')}
              >
                Force Add (Keep Both in Target)
              </button>
              
              <button
                type="button"
                onClick={() => setCrossCategoryPrompt(null)}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--neutral-500)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--neutral-700)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--neutral-500)')}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
