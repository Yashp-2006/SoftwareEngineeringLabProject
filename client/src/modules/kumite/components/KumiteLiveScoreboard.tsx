import React from 'react';
import SportdataVictoryOverlay, { NextMatchPreview } from '@/modules/shared/components/SportdataVictoryOverlay';

export type KumiteLiveScoreboardProps = {
  akaName: string;
  aoName: string;
  akaAcademy?: string;
  aoAcademy?: string;
  akaCountry?: string;
  aoCountry?: string;
  
  akaScore: number;
  aoScore: number;
  akaIppon: number;
  aoIppon: number;
  akaWazaari: number;
  aoWazaari: number;
  akaYuko: number;
  aoYuko: number;
  
  akaC1?: number;
  aoC1?: number;
  akaC2?: number;
  aoC2?: number;
  akaC3?: number;
  aoC3?: number;
  akaHC?: number;
  aoHC?: number;
  akaH?: number;
  aoH?: number;
  akaPenalties?: { c1?: boolean | number; c2?: boolean | number; c3?: boolean | number; hc?: boolean | number; h?: boolean | number };
  aoPenalties?: { c1?: boolean | number; c2?: boolean | number; c3?: boolean | number; hc?: boolean | number; h?: boolean | number };
  
  akaSenshu: boolean;
  aoSenshu: boolean;

  timerDisplay: string;
  timerColor: string;
  matchStatus: string;
  
  title?: string;
  categoryName?: string;
  matchId?: string;

  winnerName?: string;
  winnerColor?: 'aka' | 'ao';
  winnerAcademy?: string;
  nextMatch?: NextMatchPreview | null;
  onDismissWinner?: () => void;
  onProceedNextMatch?: () => void;

  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onBack?: () => void;
  
  isKata?: boolean;
  akaKataName?: string;
  aoKataName?: string;
  logoUrl?: string;
};

export function getKumiteAutoscaledFontSize(name: string): string {
  const len = (name || '').trim().length;
  if (len <= 7) return 'clamp(26px, 5.8cqw, 7.2cqw)';
  if (len <= 14) return 'clamp(22px, 4.6cqw, 5.6cqw)';
  if (len <= 22) return 'clamp(18px, 3.6cqw, 4.4cqw)';
  if (len <= 30) return 'clamp(15px, 2.9cqw, 3.5cqw)';
  return 'clamp(13px, 2.3cqw, 2.8cqw)';
}

export default function KumiteLiveScoreboard({
  akaName, aoName, akaAcademy, aoAcademy, akaCountry, aoCountry,
  akaScore, aoScore, akaIppon, aoIppon, akaWazaari, aoWazaari, akaYuko, aoYuko,
  akaC1 = 0, aoC1 = 0, akaC2 = 0, aoC2 = 0,
  akaC3 = 0, aoC3 = 0, akaHC = 0, aoHC = 0, akaH = 0, aoH = 0,
  akaPenalties, aoPenalties,
  akaSenshu, aoSenshu,
  timerDisplay, timerColor, matchStatus, title = 'KHEL KARATE', categoryName = '', matchId = '',
  winnerName, winnerColor, winnerAcademy, nextMatch, onDismissWinner, onProceedNextMatch,
  isFullscreen, onToggleFullscreen, onBack,
  isKata, akaKataName, aoKataName,
  logoUrl
}: KumiteLiveScoreboardProps) {

  const render5Penalties = (
    c1: number = 0,
    c2: number = 0,
    c3: number = 0,
    hc: number = 0,
    h: number = 0,
    pens?: { c1?: boolean | number; c2?: boolean | number; c3?: boolean | number; hc?: boolean | number; h?: boolean | number }
  ) => {
    const isC1 = Boolean(pens?.c1 ?? (c1 >= 1));
    const isC2 = Boolean(pens?.c2 ?? (c2 >= 1 || c1 >= 2));
    const isC3 = Boolean(pens?.c3 ?? (c3 >= 1 || c1 >= 3));
    const isHC = Boolean(pens?.hc ?? (hc >= 1 || c1 >= 4));
    const isH  = Boolean(pens?.h  ?? (h >= 1  || c1 >= 5));

    const slots = [
      { code: 'C1', active: isC1 },
      { code: 'C2', active: isC2 },
      { code: 'C3', active: isC3 },
      { code: 'HC', active: isHC },
      { code: 'H',  active: isH },
    ];

    return (
      <div className="kls-pen-5track">
        {slots.map((s) => (
          <div key={s.code} className="kls-pen-slot">
            <span className="kls-pen-slot-code">{s.code}</span>
            <div className={`kls-dot ${s.active ? 'active' : ''}`} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="kls-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .kls-root { container-type: inline-size; width: 100%; height: 100%; min-height: 300px; display: flex; flex-direction: column; background: var(--kuro); color: var(--shiro); font-family: var(--font-body); overflow: hidden; position: relative; }
        .kls-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5cqw 4cqw; flex-shrink: 0; z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .kls-title { font-size: 2cqw; font-weight: 800; color: var(--shiro); line-height: 1.2; }
        .kls-subtitle { font-size: 1cqw; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.3cqw; }
        .kls-header-actions { display: flex; gap: 1cqw; }
        .kls-btn { display: inline-flex; align-items: center; gap: 0.5cqw; padding: 0.8cqw 1.2cqw; border-radius: 0.5cqw; font-size: 1cqw; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: var(--shiro); transition: background 160ms var(--ease-out); }
        .kls-btn:hover { background: rgba(255,255,255,0.1); }
        
        .kls-container { flex: 1; display: grid; grid-template-columns: 1fr minmax(15cqw, 20cqw) 1fr; position: relative; min-height: 0; height: 100%; overflow: hidden; }
        
        .kls-side { display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 2cqw 3cqw 3cqw; position: relative; transition: background-color 0.3s ease; height: 100%; min-height: 0; box-sizing: border-box; overflow: hidden; }
        .kls-side.aka { background: var(--aka); }
        .kls-side.ao { background: var(--ao); }
        
        .kls-fighter-header { display: flex; flex-direction: column; align-items: center; width: 100%; flex-shrink: 0; }
        .kls-country { font-family: var(--font-display); font-size: 1.8cqw; color: rgba(255,255,255,0.7); letter-spacing: 0.1em; margin-bottom: 0.5cqw; text-align: center; }
        .kls-name { font-family: var(--font-display); line-height: 1.1; text-transform: uppercase; text-align: center; text-shadow: 0 0.5cqw 1cqw rgba(0,0,0,0.3); word-break: break-word; max-width: 100%; max-height: 2.3em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; }
        
        .kls-score-wrap { position: relative; display: flex; align-items: center; justify-content: center; flex: 1; min-height: 0; }
        .kls-score { font-family: var(--font-display); font-size: clamp(70px, 16cqw, 20cqw); line-height: 0.85; margin: 0; color: var(--shiro); }
        
        .kls-fighter-footer { display: flex; flex-direction: column; align-items: center; width: 100%; flex-shrink: 0; margin-top: auto; }
        .kls-points { display: flex; justify-content: center; gap: 2.5cqw; margin-bottom: 1.2cqw; flex-shrink: 0; }
        .kls-pt-item { display: flex; flex-direction: column; align-items: center; gap: 0.3cqw; }
        .kls-pt-label { font-size: 1.1cqw; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; }
        .kls-pt-val { font-family: var(--font-display); font-size: 3.2cqw; line-height: 1; font-weight: 800; }
        
        .kls-pens { display: flex; flex-direction: column; align-items: center; gap: 0.6cqw; width: 100%; max-width: 32cqw; flex-shrink: 0; }
        .kls-pen-title { font-size: 0.9cqw; font-weight: 800; text-transform: uppercase; opacity: 0.75; text-align: center; letter-spacing: 0.1em; }
        .kls-pen-5track { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0.6cqw 1.2cqw; background: rgba(0,0,0,0.25); border-radius: 0.8cqw; border: 1px solid rgba(255,255,255,0.15); box-sizing: border-box; }
        .kls-pen-slot { display: flex; flex-direction: column; align-items: center; gap: 0.4cqw; }
        .kls-pen-slot-code { font-family: var(--font-mono); font-size: 1.1cqw; font-weight: 800; letter-spacing: 0.05em; color: rgba(255,255,255,0.85); }
        .kls-dot { width: 1.3cqw; height: 1.3cqw; border-radius: 50%; background: rgba(255,255,255,0.15); border: 1.5px solid rgba(255,255,255,0.35); transition: background 200ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1); }
        .kls-dot.active { background: #facc15; box-shadow: 0 0 1cqw #facc15, 0 0 1.5cqw #ffffff; border-color: #ffffff; }
        
        .kls-senshu { position: absolute; top: 3cqw; font-family: var(--font-display); font-size: 2cqw; background: var(--shiro); color: var(--kuro); padding: 0.5cqw 1.5cqw; border-radius: 0.5cqw; opacity: 0; transition: opacity 0.3s ease; }
        .kls-senshu.active { opacity: 1; }
        
        .kls-center { display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 3cqw 0; background: var(--kuro); border-left: 1px solid var(--neutral-900); border-right: 1px solid var(--neutral-900); z-index: 10; }
        .kls-logo { font-family: var(--font-display); font-size: 2cqw; color: var(--shiro); letter-spacing: 0.1em; text-align: center; max-height: 8cqw; display: flex; align-items: center; justify-content: center; }
        .kls-logo-img { max-height: 7cqw; max-width: 14cqw; object-fit: contain; }
        
        .kls-timer-wrap { display: flex; flex-direction: column; align-items: center; gap: 1cqw; }
        .kls-timer { font-family: var(--font-mono); font-size: 6cqw; font-weight: 700; line-height: 1; }
        .kls-status { text-transform: uppercase; font-size: 1cqw; letter-spacing: 0.2em; font-weight: 700; }
        
        .kls-info { text-align: center; display: flex; flex-direction: column; gap: 0.5cqw; }
        .kls-match-id { font-family: var(--font-display); font-size: 1.5cqw; color: var(--neutral-500); }
        .kls-cat { font-size: 1cqw; font-weight: 600; color: var(--neutral-300); text-transform: uppercase; max-width: 15cqw; margin: 0 auto; line-height: 1.4; }
        
        .kls-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 200; opacity: 0; pointer-events: none; transition: opacity 0.5s ease; }
        .kls-overlay.active { opacity: 1; pointer-events: auto; }
        .kls-win-label { font-family: var(--font-display); font-size: 3cqw; color: var(--status-live); letter-spacing: 0.2em; margin-bottom: 2cqw; }
        .kls-win-name { font-family: var(--font-display); font-size: 10cqw; text-transform: uppercase; text-align: center; line-height: 1; max-width: 90cqw; }
        .kls-win-aka { color: var(--aka); }
        .kls-win-ao { color: var(--ao); }
        
        @media (max-width: 768px) {
          .kls-container {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            scroll-behavior: smooth;
          }
          .kls-container::-webkit-scrollbar { display: none; }
          .kls-side { min-width: 100vw; scroll-snap-align: start; padding: 6cqw; }
          .kls-center { min-width: 100vw; scroll-snap-align: start; }
          .kls-score { font-size: 30cqw; }
          .kls-name { font-size: 10cqw; }
          .kls-timer { font-size: 12cqw; }
        }
      `}} />

      {winnerName && winnerColor && (
        <SportdataVictoryOverlay
          winnerName={winnerName}
          winnerColor={winnerColor}
          winnerAcademy={winnerAcademy || (winnerColor === 'aka' ? akaAcademy : aoAcademy)}
          winnerCountry={winnerColor === 'aka' ? akaCountry : aoCountry}
          finalScore={{
            aka: akaScore,
            ao: aoScore,
            senshuWinner: akaSenshu ? 'aka' : (aoSenshu ? 'ao' : null)
          }}
          isKata={isKata}
          kataName={winnerColor === 'aka' ? akaKataName : aoKataName}
          nextMatch={nextMatch}
          onDismiss={onDismissWinner}
          onProceedNextMatch={onProceedNextMatch}
        />
      )}

      {(title || categoryName || onToggleFullscreen || onBack || logoUrl) && (
        <div className="kls-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5cqw' }}>
            {logoUrl && (
              <img src={logoUrl} alt="Logo" style={{ height: '3cqw', width: 'auto', maxHeight: '48px', objectFit: 'contain' }} />
            )}
            <div>
              <div className="kls-title">{title}</div>
              <div className="kls-subtitle">{categoryName} • {matchId}</div>
            </div>
          </div>
          <div className="kls-header-actions">
            {onToggleFullscreen && (
              <button className="kls-btn" onClick={onToggleFullscreen}>
                {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              </button>
            )}
            {onBack && <button className="kls-btn" onClick={onBack}>← Return</button>}
          </div>
        </div>
      )}

      <div className="kls-container">
        <div className={`kls-side aka ${winnerColor === 'aka' ? 'kls-winner-glow' : ''} ${winnerColor === 'ao' ? 'kls-loser-dim' : ''}`}>
          {akaSenshu && !isKata && <div className="kls-senshu active">SENSHU</div>}
          <div className="kls-fighter-header">
            <div className="kls-country">{akaCountry || 'AKA'}</div>
            <div className="kls-name" title={akaName} style={{ fontSize: getKumiteAutoscaledFontSize(akaName) }}>{akaName}</div>
          </div>
          
          {isKata ? (
            <div style={{ marginTop: '2cqw', padding: '1cqw 2cqw', background: 'rgba(255,255,255,0.1)', borderRadius: '1cqw', textAlign: 'center' }}>
              <div style={{ fontSize: '1cqw', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', marginBottom: '0.5cqw' }}>Kata</div>
              <div style={{ fontSize: '2.5cqw', fontWeight: 800, fontFamily: 'var(--font-display)', minHeight: '3cqw' }}>{akaKataName || '-'}</div>
            </div>
          ) : (
            <>
              <div className="kls-score-wrap">
                <h2 className="kls-score">{akaScore}</h2>
              </div>

              <div className="kls-fighter-footer">
                <div className="kls-points">
                  <div className="kls-pt-item"><span className="kls-pt-label">Y</span><span className="kls-pt-val">{akaYuko}</span></div>
                  <div className="kls-pt-item"><span className="kls-pt-label">W</span><span className="kls-pt-val">{akaWazaari}</span></div>
                  <div className="kls-pt-item"><span className="kls-pt-label">I</span><span className="kls-pt-val">{akaIppon}</span></div>
                </div>
                
                <div className="kls-pens">
                  <div className="kls-pen-title">Penalties</div>
                  {render5Penalties(akaC1, akaC2, akaC3, akaHC, akaH, akaPenalties)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* CENTER COLUMN */}
        <div className="kls-center">
          <div className="kls-logo">
            {logoUrl ? (
              <img src={logoUrl} alt={title || "Competition Logo"} className="kls-logo-img" />
            ) : (
              title
            )}
          </div>
          
          <div className="kls-timer-wrap">
            <div className="kls-timer" style={{ color: timerColor }}>
              {timerDisplay}
            </div>
            <div className="kls-status" style={{ color: matchStatus === 'MATCH LIVE' ? 'var(--status-live)' : 'var(--neutral-500)' }}>
              {matchStatus}
            </div>
          </div>

          <div className="kls-info">
            {matchId && <div className="kls-match-id">{matchId}</div>}
            {categoryName && <div className="kls-cat">{categoryName}</div>}
          </div>
        </div>

        {/* AO SIDE */}
        <div className={`kls-side ao ${winnerColor === 'ao' ? 'kls-winner-glow' : ''} ${winnerColor === 'aka' ? 'kls-loser-dim' : ''}`}>
          {aoSenshu && !isKata && <div className="kls-senshu active">SENSHU</div>}
          <div className="kls-fighter-header">
            <div className="kls-country">{aoCountry || 'AO'}</div>
            <div className="kls-name" title={aoName} style={{ fontSize: getKumiteAutoscaledFontSize(aoName) }}>{aoName}</div>
          </div>
          
          {isKata ? (
            <div style={{ marginTop: '2cqw', padding: '1cqw 2cqw', background: 'rgba(255,255,255,0.1)', borderRadius: '1cqw', textAlign: 'center' }}>
              <div style={{ fontSize: '1cqw', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', marginBottom: '0.5cqw' }}>Kata</div>
              <div style={{ fontSize: '2.5cqw', fontWeight: 800, fontFamily: 'var(--font-display)', minHeight: '3cqw' }}>{aoKataName || '-'}</div>
            </div>
          ) : (
            <>
              <div className="kls-score-wrap">
                <h2 className="kls-score">{aoScore}</h2>
              </div>
              
              <div className="kls-fighter-footer">
                <div className="kls-points">
                  <div className="kls-pt-item"><span className="kls-pt-label">Y</span><span className="kls-pt-val">{aoYuko}</span></div>
                  <div className="kls-pt-item"><span className="kls-pt-label">W</span><span className="kls-pt-val">{aoWazaari}</span></div>
                  <div className="kls-pt-item"><span className="kls-pt-label">I</span><span className="kls-pt-val">{aoIppon}</span></div>
                </div>
                
                <div className="kls-pens">
                  <div className="kls-pen-title">Penalties</div>
                  {render5Penalties(aoC1, aoC2, aoC3, aoHC, aoH, aoPenalties)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
