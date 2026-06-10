'use client';

import React from 'react';

interface Score {
  aka: Record<string, number | null>;
  ao: Record<string, number | null>;
}

interface JudgeScoreGridProps {
  numberOfJudges: number;
  scores: Score;
  isDQ: { aka: boolean; ao: boolean };
  finished: boolean;
  errorCells?: { aka: Set<number>; ao: Set<number> };
  onScoreChange: (side: 'aka' | 'ao', judgeIdx: number, value: number | null) => void;
  onDQJudge: (side: 'aka' | 'ao', judgeIdx: number) => void;
}

export default function JudgeScoreGrid({
  numberOfJudges,
  scores,
  isDQ,
  finished,
  errorCells,
  onScoreChange,
  onDQJudge,
}: JudgeScoreGridProps) {
  const judges = Array.from({ length: numberOfJudges }, (_, i) => i);

  const getVoteColor = (judgeIdx: number): string | undefined => {
    if (!finished) return undefined;
    const akaScore = scores.aka[judgeIdx] ?? null;
    const aoScore = scores.ao[judgeIdx] ?? null;
    if (akaScore === null || aoScore === null) return undefined;
    if (akaScore > aoScore) return 'rgba(217,38,44,0.12)';
    if (aoScore > akaScore) return 'rgba(26,77,181,0.12)';
    return 'var(--neutral-50)';
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `80px repeat(${numberOfJudges}, 1fr)`,
          border: '1px solid var(--neutral-200)',
          borderRadius: '12px',
          overflow: 'hidden',
          minWidth: `${80 + numberOfJudges * 100}px`,
        }}
      >
        {/* Header row */}
        <div style={{ padding: '10px 12px', background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-200)', fontWeight: 800, fontSize: '11px', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>
          Side
        </div>
        {judges.map((i) => (
          <div
            key={i}
            style={{
              padding: '10px 12px',
              background: finished ? getVoteColor(i) : 'var(--neutral-50)',
              borderBottom: '1px solid var(--neutral-200)',
              borderLeft: '1px solid var(--neutral-200)',
              textAlign: 'center',
              fontWeight: 800,
              fontSize: '11px',
              color: 'var(--neutral-700)',
              textTransform: 'uppercase',
              transition: 'background 0.4s',
            }}
          >
            J{i + 1}
          </div>
        ))}

        {/* AKA row */}
        <div style={{ padding: '12px', background: 'rgba(217,38,44,0.04)', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px', color: 'var(--aka)' }}>
          AKA
        </div>
        {judges.map((i) => {
          const val = scores.aka[i];
          const isError = errorCells?.aka.has(i);
          const isJudgeDQ = val === 0;

          return (
            <div
              key={i}
              style={{
                padding: '8px',
                borderLeft: '1px solid var(--neutral-200)',
                borderBottom: '1px solid var(--neutral-100)',
                background: finished
                  ? getVoteColor(i)
                  : isError
                  ? '#fef2f2'
                  : isJudgeDQ
                  ? '#fef2f2'
                  : 'rgba(217,38,44,0.02)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                transition: 'background 0.4s',
              }}
            >
              {finished ? (
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: val === 0 ? 'var(--neutral-400)' : 'var(--neutral-900)',
                    animation: 'fadeInUp 0.4s ease forwards',
                    animationDelay: `${i * 0.07}s`,
                    opacity: 0,
                  }}
                >
                  {val === null ? '—' : val === 0 ? 'DQ' : val?.toFixed(1)}
                </div>
              ) : (
                <>
                  {isJudgeDQ && !finished ? (
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--aka)', background: '#fef2f2', padding: '4px 8px', borderRadius: '4px' }}>
                      DQ
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="5.0"
                      max="10.0"
                      step="0.1"
                      disabled={finished || isDQ.aka}
                      value={val === null ? '' : val}
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value);
                        if (isNaN(raw)) {
                          onScoreChange('aka', i, null);
                        } else {
                          onScoreChange('aka', i, Math.min(10, Math.max(5, raw)));
                        }
                      }}
                      style={{
                        width: '64px',
                        padding: '4px 6px',
                        border: `1.5px solid ${isError ? 'var(--aka)' : 'var(--neutral-300)'}`,
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: '13px',
                        outline: 'none',
                        background: isDQ.aka ? 'var(--neutral-100)' : 'var(--shiro)',
                      }}
                      placeholder="—"
                    />
                  )}
                  <button
                    type="button"
                    disabled={finished || isDQ.aka}
                    onClick={() => onDQJudge('aka', i)}
                    style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '3px',
                      border: '1px solid rgba(217,38,44,0.3)',
                      color: 'var(--aka)',
                      background: 'transparent',
                      cursor: finished || isDQ.aka ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.05em',
                    }}
                  >
                    DQ
                  </button>
                </>
              )}
            </div>
          );
        })}

        {/* AO row */}
        <div style={{ padding: '12px', background: 'rgba(26,77,181,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px', color: 'var(--ao)' }}>
          AO
        </div>
        {judges.map((i) => {
          const val = scores.ao[i];
          const isError = errorCells?.ao.has(i);
          const isJudgeDQ = val === 0;

          return (
            <div
              key={i}
              style={{
                padding: '8px',
                borderLeft: '1px solid var(--neutral-200)',
                background: finished
                  ? getVoteColor(i)
                  : isError
                  ? '#eff6ff'
                  : isJudgeDQ
                  ? '#eff6ff'
                  : 'rgba(26,77,181,0.02)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                transition: 'background 0.4s',
              }}
            >
              {finished ? (
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: val === 0 ? 'var(--neutral-400)' : 'var(--neutral-900)',
                    animation: 'fadeInUp 0.4s ease forwards',
                    animationDelay: `${i * 0.07 + 0.3}s`,
                    opacity: 0,
                  }}
                >
                  {val === null ? '—' : val === 0 ? 'DQ' : val?.toFixed(1)}
                </div>
              ) : (
                <>
                  {isJudgeDQ && !finished ? (
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ao)', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px' }}>
                      DQ
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="5.0"
                      max="10.0"
                      step="0.1"
                      disabled={finished || isDQ.ao}
                      value={val === null ? '' : val}
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value);
                        if (isNaN(raw)) {
                          onScoreChange('ao', i, null);
                        } else {
                          onScoreChange('ao', i, Math.min(10, Math.max(5, raw)));
                        }
                      }}
                      style={{
                        width: '64px',
                        padding: '4px 6px',
                        border: `1.5px solid ${isError ? 'var(--ao)' : 'var(--neutral-300)'}`,
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: '13px',
                        outline: 'none',
                        background: isDQ.ao ? 'var(--neutral-100)' : 'var(--shiro)',
                      }}
                      placeholder="—"
                    />
                  )}
                  <button
                    type="button"
                    disabled={finished || isDQ.ao}
                    onClick={() => onDQJudge('ao', i)}
                    style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '3px',
                      border: '1px solid rgba(26,77,181,0.3)',
                      color: 'var(--ao)',
                      background: 'transparent',
                      cursor: finished || isDQ.ao ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.05em',
                    }}
                  >
                    DQ
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
