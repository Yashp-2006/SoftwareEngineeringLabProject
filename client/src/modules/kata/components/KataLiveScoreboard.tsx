'use client';

import React from 'react';

// ─── Flag SVG Component ─────────────────────────────────────────────────────────

const FlagIcon = ({ color, size = 28 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12z" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="4" y1="22" x2="4" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ─── Props ───────────────────────────────────────────────────────────────────────

export interface KataLiveScoreboardProps {
  // Match data
  akaName: string;
  aoName: string;
  akaAcademy?: string;
  aoAcademy?: string;
  akaCountry?: string;
  aoCountry?: string;
  akaKataName?: string;
  aoKataName?: string;

  // Judge voting
  numberOfJudges: number; // 3, 5, or 7
  judgeVotes: Array<'aka' | 'ao' | 'tie' | null>; // length === numberOfJudges
  akaFlags: number;
  aoFlags: number;

  // Center column
  matchId?: string;
  timeRemaining: string; // "03:00"
  matchStatus: string;   // "UPCOMING" | "LIVE" | "COMPLETED" etc.
  logoUrl?: string;

  // Header
  title: string;
  subtitle: string;
  onBack?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;

  // Kata winner (if decided)
  kataWinner?: 'aka' | 'ao' | 'tie_pending' | null;
  winnerName?: string;

  // Reveal settings
  revealVotes?: boolean;
  revealCountdown?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────────

export default function KataLiveScoreboard({
  akaName,
  aoName,
  akaAcademy,
  aoAcademy,
  akaCountry,
  aoCountry,
  akaKataName,
  aoKataName,
  numberOfJudges,
  judgeVotes,
  akaFlags,
  aoFlags,

  timeRemaining,
  matchStatus,
  logoUrl,
  title,
  subtitle,
  onBack,
  onToggleFullscreen,
  isFullscreen,
  kataWinner,
  winnerName,
  revealVotes = true,
  revealCountdown = 0,
}: KataLiveScoreboardProps) {
  const judges = Array.from({ length: numberOfJudges }, (_, i) => i);

  // Compute judge card sizing based on count
  const judgeCardHeight = numberOfJudges <= 3 ? 110 : numberOfJudges <= 5 ? 82 : 64;
  const judgeLabelSize = numberOfJudges <= 5 ? 11 : 10;
  const judgeFlagSize = numberOfJudges <= 3 ? 32 : numberOfJudges <= 5 ? 26 : 22;
  const judgeGap = numberOfJudges <= 3 ? 16 : numberOfJudges <= 5 ? 12 : 8;

  const isWinnerDeclared = kataWinner === 'aka' || kataWinner === 'ao';

  // ─── Winner Showcase ─────────────────────────────────────────────────────────

  if (isWinnerDeclared) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: kataScoreboadStyles }} />
        <div className="kls-root">
          <div className="kls-header">
            <div>
              <div className="kls-title">{title}</div>
              <div className="kls-subtitle">{subtitle}</div>
            </div>
            <div className="kls-header-actions">
              {onToggleFullscreen && (
                <button className="kls-btn" onClick={onToggleFullscreen}>
                  {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                </button>
              )}
              {onBack && <button className="kls-btn kls-btn-dark" onClick={onBack}>← Return</button>}
            </div>
          </div>

          <div className="kls-winner-wrap">
            <div className={`kls-winner-showcase ${kataWinner}`}>
              <div className="kls-winner-label">{kataWinner === 'aka' ? 'AKA WINS' : 'AO WINS'}</div>
              <div className="kls-winner-flags">{kataWinner === 'aka' ? akaFlags : aoFlags}</div>
              <div className="kls-winner-name">{winnerName || (kataWinner === 'aka' ? akaName : aoName)}</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Regular Scoreboard ──────────────────────────────────────────────────────

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: kataScoreboadStyles }} />
      <div className="kls-root">
        {revealCountdown > 0 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            borderRadius: '16px',
            color: '#fff',
          }}>
            <div style={{ fontSize: '1.2cqw', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--neutral-400)', marginBottom: '24px' }}>
              Revealing Judges' Decision
            </div>
            <div style={{
              fontSize: '10cqw',
              fontWeight: 900,
              fontFamily: 'var(--font-display)',
              lineHeight: 1,
              animation: 'kls-pulse-dot 1s ease-in-out infinite',
              color: 'var(--ao)'
            }}>
              {revealCountdown}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="kls-header">
          <div>
            <div className="kls-title">{title}</div>
            <div className="kls-subtitle">{subtitle}</div>
          </div>
          <div className="kls-header-actions">
            {onToggleFullscreen && (
              <button className="kls-btn" onClick={onToggleFullscreen}>
                {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              </button>
            )}
            {onBack && <button className="kls-btn kls-btn-dark" onClick={onBack}>← Return</button>}
          </div>
        </div>

        {/* Body: 5-column grid */}
        <div className="kls-body">
          {/* AKA Judge Column */}
          <div className="kls-judge-col" style={{ gap: `${judgeGap}px` }}>
            {judges.map(i => {
              const vote = judgeVotes[i];
              const hasFlag = revealVotes && vote === 'aka';
              return (
                <div
                  key={i}
                  className={`kls-judge-card${hasFlag ? ' kls-judge-active-aka' : ''}`}
                  style={{ height: `${judgeCardHeight}px` }}
                >
                  <div className="kls-judge-label" style={{ fontSize: `${judgeLabelSize}px` }}>
                    JUDGE {i + 1}
                  </div>
                  <div className="kls-judge-flag">
                    {hasFlag ? (
                      <FlagIcon color="var(--aka)" size={judgeFlagSize} />
                    ) : (
                      <div className="kls-judge-empty" style={{ width: judgeFlagSize, height: judgeFlagSize }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* AKA Fighter Card */}
          <div className="kls-fighter-card">
            <div className="kls-fighter-head kls-fighter-head-aka">
              <div className="kls-fighter-lane">AKA</div>
              <div className="kls-fighter-name">{akaName}</div>
            </div>
            <div className="kls-fighter-body">
              <div className="kls-flag-count kls-flag-count-aka">{revealVotes ? akaFlags : 0}</div>
              <div className="kls-flag-label">FLAGS</div>
            </div>
            <div className="kls-fighter-foot">
              {akaKataName ? (
                <div className="kls-kata-chip kls-kata-chip-aka">{akaKataName}</div>
              ) : (
                <div className="kls-kata-chip kls-kata-chip-empty">KATA NOT SELECTED</div>
              )}
              <div className="kls-fighter-academy">
                {[akaAcademy, akaCountry].filter(Boolean).join(' • ')}
              </div>
            </div>
          </div>

          {/* Center Column */}
          <div className="kls-center">

            {logoUrl && (
              <div className="kls-logo-wrap">
                <img src={logoUrl} alt="Competition Logo" className="kls-logo-img" />
              </div>
            )}
            <div className="kls-timer-label">
              {matchStatus === 'live' ? 'TIME REMAINING' : 'MATCH TIME'}
            </div>
            <div className={`kls-timer${timeRemaining.startsWith('00:0') && !timeRemaining.startsWith('00:00') ? ' kls-timer-warn' : ''}`}>
              {timeRemaining}
            </div>
            <div className="kls-status-wrap">
              <div className="kls-status-label">Match Status</div>
              <div className={`kls-status-pill${matchStatus === 'live' ? ' kls-status-live' : ''}`}>
                {matchStatus}
              </div>
            </div>
            {kataWinner === 'tie_pending' && (
              <div className="kls-tie-badge">TIE — RESOLUTION PENDING</div>
            )}
          </div>

          {/* AO Fighter Card */}
          <div className="kls-fighter-card">
            <div className="kls-fighter-head kls-fighter-head-ao">
              <div className="kls-fighter-lane">AO</div>
              <div className="kls-fighter-name">{aoName}</div>
            </div>
            <div className="kls-fighter-body">
              <div className="kls-flag-count kls-flag-count-ao">{revealVotes ? aoFlags : 0}</div>
              <div className="kls-flag-label">FLAGS</div>
            </div>
            <div className="kls-fighter-foot">
              {aoKataName ? (
                <div className="kls-kata-chip kls-kata-chip-ao">{aoKataName}</div>
              ) : (
                <div className="kls-kata-chip kls-kata-chip-empty">KATA NOT SELECTED</div>
              )}
              <div className="kls-fighter-academy">
                {[aoAcademy, aoCountry].filter(Boolean).join(' • ')}
              </div>
            </div>
          </div>

          {/* AO Judge Column */}
          <div className="kls-judge-col" style={{ gap: `${judgeGap}px` }}>
            {judges.map(i => {
              const vote = judgeVotes[i];
              const hasFlag = revealVotes && vote === 'ao';
              return (
                <div
                  key={i}
                  className={`kls-judge-card${hasFlag ? ' kls-judge-active-ao' : ''}`}
                  style={{ height: `${judgeCardHeight}px` }}
                >
                  <div className="kls-judge-label" style={{ fontSize: `${judgeLabelSize}px` }}>
                    JUDGE {i + 1}
                  </div>
                  <div className="kls-judge-flag">
                    {hasFlag ? (
                      <FlagIcon color="var(--ao)" size={judgeFlagSize} />
                    ) : (
                      <div className="kls-judge-empty" style={{ width: judgeFlagSize, height: judgeFlagSize }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Styles (all using design tokens) ────────────────────────────────────────────

const kataScoreboadStyles = `
  .kls-root {
    position: fixed;
    inset: 0;
    background: var(--neutral-50);
    z-index: 9999;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .kls-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 40px;
    flex-shrink: 0;
  }
  .kls-title {
    font-size: 28px;
    font-weight: 800;
    color: var(--neutral-900);
    line-height: 1.2;
  }
  .kls-title span { color: var(--aka); }
  .kls-subtitle {
    font-size: 13px;
    font-weight: 700;
    color: var(--neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-top: 2px;
  }
  .kls-header-actions {
    display: flex;
    gap: 12px;
  }
  .kls-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--neutral-300);
    background: var(--shiro);
    color: var(--neutral-700);
    transition: background 160ms var(--ease-out), border-color 160ms var(--ease-out);
  }
  .kls-btn:hover { background: var(--neutral-50); border-color: var(--neutral-400); }
  .kls-btn:active { transform: scale(0.97); }
  .kls-btn-dark { background: var(--neutral-900); color: var(--shiro); border-color: var(--neutral-900); }
  .kls-btn-dark:hover { background: var(--neutral-700); }

  /* Body: 5-column grid */
  .kls-body {
    display: grid;
    grid-template-columns: minmax(100px, 140px) 1fr minmax(160px, 200px) 1fr minmax(100px, 140px);
    gap: 24px;
    padding: 0 40px 40px;
    flex: 1;
    min-height: 0;
    align-items: stretch;
  }

  /* Judge Column */
  .kls-judge-col {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex-shrink: 0;
  }
  .kls-judge-card {
    background: var(--shiro);
    border: 1.5px solid var(--neutral-200);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
    transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1), background 200ms var(--ease-out), border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out);
    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  }
  .kls-judge-card.kls-judge-active-aka {
    border-color: var(--aka);
    background: var(--aka-light);
    box-shadow: 0 4px 16px rgba(217,38,44,0.1);
  }
  .kls-judge-card.kls-judge-active-ao {
    border-color: var(--ao);
    background: var(--ao-light);
    box-shadow: 0 4px 16px rgba(26,77,181,0.1);
  }
  .kls-judge-label {
    font-weight: 800;
    text-transform: uppercase;
    color: var(--neutral-500);
    letter-spacing: 0.08em;
    margin-bottom: 6px;
  }
  .kls-judge-flag { display: flex; align-items: center; justify-content: center; }
  .kls-judge-empty {
    border-radius: 4px;
    border: 2px dashed var(--neutral-200);
  }

  /* Fighter Card */
  .kls-fighter-card {
    background: var(--shiro);
    border: 1px solid var(--neutral-200);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 12px 32px rgba(0,0,0,0.04);
  }
  .kls-fighter-head {
    padding: 16px 24px;
    text-align: center;
    color: var(--shiro);
    flex-shrink: 0;
  }
  .kls-fighter-head-aka { background: var(--aka); }
  .kls-fighter-head-ao { background: var(--ao); }
  .kls-fighter-lane {
    font-size: 14px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.9;
    margin-bottom: 4px;
  }
  .kls-fighter-name {
    font-size: clamp(28px, 3.5vw, 44px);
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .kls-fighter-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: 24px;
  }
  .kls-flag-count {
    font-family: var(--font-display);
    font-size: clamp(100px, 12vw, 200px);
    font-weight: 800;
    line-height: 1;
  }
  .kls-flag-count-aka { color: var(--aka); }
  .kls-flag-count-ao { color: var(--ao); }
  .kls-flag-label {
    font-size: 14px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--neutral-400);
    margin-top: 8px;
  }

  .kls-fighter-foot {
    padding: 16px 24px;
    border-top: 1px solid var(--neutral-200);
    text-align: center;
    flex-shrink: 0;
  }
  .kls-kata-chip {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }
  .kls-kata-chip-aka { background: rgba(217,38,44,0.08); color: var(--aka); }
  .kls-kata-chip-ao { background: rgba(26,77,181,0.08); color: var(--ao); }
  .kls-kata-chip-empty {
    background: var(--neutral-100);
    color: var(--neutral-400);
    font-style: italic;
  }
  .kls-fighter-academy {
    font-size: 13px;
    font-weight: 700;
    color: var(--neutral-600);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Center Column */
  .kls-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 12px;
  }
  .kls-round-pill {
    border: 1px solid var(--neutral-300);
    background: var(--shiro);
    padding: 4px 16px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }
  .kls-logo-wrap {
    width: 120px;
    height: 120px;
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .kls-logo-img { width: 100%; height: 100%; object-fit: contain; }
  .kls-timer-label {
    font-size: 12px;
    font-weight: 800;
    color: var(--neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .kls-timer {
    background: var(--shiro);
    border: 1px solid var(--neutral-200);
    border-radius: 16px;
    width: 100%;
    padding: 16px 0;
    font-family: var(--font-mono);
    font-size: clamp(36px, 5vw, 56px);
    font-weight: 800;
    color: var(--neutral-900);
    box-shadow: 0 8px 24px rgba(0,0,0,0.03);
  }
  .kls-timer-warn { color: var(--aka); }
  .kls-status-wrap {
    width: 100%;
    background: var(--shiro);
    border: 1px solid var(--neutral-200);
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
  }
  .kls-status-label {
    font-size: 11px;
    font-weight: 800;
    color: var(--neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 6px;
  }
  .kls-status-pill {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    background: var(--neutral-100);
    color: var(--neutral-600);
  }
  .kls-status-pill.kls-status-live {
    background: var(--status-live-bg);
    color: var(--status-live);
  }
  .kls-tie-badge {
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(251,191,36,0.15);
    border: 1.5px solid rgba(251,191,36,0.4);
    color: rgba(180,83,9,1);
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 4px;
  }

  /* Winner Showcase */
  .kls-winner-wrap {
    flex: 1;
    display: flex;
    padding: 0 40px 40px;
    min-height: 0;
  }
  .kls-winner-showcase {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 24px;
    text-align: center;
    color: var(--shiro);
    animation: klsWinnerPop 0.6s cubic-bezier(0.23, 1, 0.32, 1);
  }
  .kls-winner-showcase.aka { background: var(--aka); }
  .kls-winner-showcase.ao { background: var(--ao); }
  .kls-winner-label {
    font-size: clamp(36px, 5vw, 56px);
    font-weight: 800;
    letter-spacing: 0.1em;
    margin-bottom: 24px;
    text-transform: uppercase;
  }
  .kls-winner-flags {
    font-family: var(--font-display);
    font-size: clamp(120px, 18vw, 280px);
    font-weight: 800;
    line-height: 1;
    margin-bottom: 24px;
  }
  .kls-winner-name {
    font-family: var(--font-display);
    font-size: clamp(48px, 7vw, 100px);
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
  }

  @keyframes klsWinnerPop {
    from { opacity: 0; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
  }

  @media (max-width: 768px) {
    .kls-container {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
    }
    .kls-container::-webkit-scrollbar { display: none; }
    .kls-side { min-width: 100vw; scroll-snap-align: start; padding: 24px; }
    .kls-center { min-width: 100vw; scroll-snap-align: start; }
    .kls-name { font-size: 40px; }
    .kls-timer { font-size: 48px; }
    .kls-flag-count { font-size: 100px; }
  }
`;

// ─── Helper: derive judgeVotes array from RTDB kataScores ────────────────────

export function deriveJudgeVotes(
  kataScores: { aka?: Record<string, number | null>; ao?: Record<string, number | null> } | null | undefined,
  numberOfJudges: number
): { judgeVotes: Array<'aka' | 'ao' | 'tie' | null>; akaFlags: number; aoFlags: number } {
  const judgeVotes: Array<'aka' | 'ao' | 'tie' | null> = [];
  let akaFlags = 0;
  let aoFlags = 0;

  if (!kataScores?.aka || !kataScores?.ao) {
    return { judgeVotes: Array(numberOfJudges).fill(null), akaFlags: 0, aoFlags: 0 };
  }

  for (let i = 0; i < numberOfJudges; i++) {
    const a = kataScores.aka[String(i)] ?? null;
    const b = kataScores.ao[String(i)] ?? null;
    if (a === null || b === null) {
      judgeVotes.push(null);
    } else if (a > b) {
      judgeVotes.push('aka');
      akaFlags++;
    } else if (b > a) {
      judgeVotes.push('ao');
      aoFlags++;
    } else {
      judgeVotes.push('tie');
    }
  }

  return { judgeVotes, akaFlags, aoFlags };
}
