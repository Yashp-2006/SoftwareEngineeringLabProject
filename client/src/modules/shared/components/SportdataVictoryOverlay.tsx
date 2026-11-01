'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Trophy, ChevronRight, X, Sparkles, CheckCircle2 } from 'lucide-react';

export interface NextMatchPreview {
  matchId?: string;
  aka: string;
  ao: string;
  akaAcademy?: string;
  aoAcademy?: string;
  category?: string;
  akaReady?: boolean;
  aoReady?: boolean;
}

export interface SportdataVictoryOverlayProps {
  winnerName: string;
  winnerColor: 'aka' | 'ao';
  winnerAcademy?: string;
  winnerCountry?: string;
  finalScore?: {
    aka: number;
    ao: number;
    senshuWinner?: 'aka' | 'ao' | null;
  };
  isKata?: boolean;
  kataFlags?: {
    aka: number;
    ao: number;
  };
  kataName?: string;
  nextMatch?: NextMatchPreview | null;
  durationSeconds?: number;
  onDismiss?: () => void;
  onProceedNextMatch?: () => void;
}

export default function SportdataVictoryOverlay({
  winnerName,
  winnerColor,
  winnerAcademy,
  winnerCountry,
  finalScore,
  isKata = false,
  kataFlags,
  kataName,
  nextMatch,
  durationSeconds = 7,
  onDismiss,
  onProceedNextMatch,
}: SportdataVictoryOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const isAka = winnerColor === 'aka';

  // Play subtle victory chime on mount via Web Audio API
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Chord: Root -> 3rd -> 5th -> Octave
      const notes = isAka ? [440, 554.37, 659.25, 880] : [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.65);
      });
    } catch {
      // AudioContext autoplay restrictions are handled gracefully
    }
  }, [isAka]);

  // Countdown timer effect
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (onProceedNextMatch) {
        onProceedNextMatch();
      } else if (onDismiss) {
        onDismiss();
      }
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onProceedNextMatch) onProceedNextMatch();
          else if (onDismiss) onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, onDismiss, onProceedNextMatch]);

  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / durationSeconds) * 100));

  return (
    <div
      className="sportdata-victory-root"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: isAka
          ? 'radial-gradient(circle at center, rgba(159, 18, 57, 0.96) 0%, rgba(15, 23, 42, 0.98) 85%)'
          : 'radial-gradient(circle at center, rgba(30, 64, 175, 0.96) 0%, rgba(15, 23, 42, 0.98) 85%)',
        backdropFilter: 'blur(20px)',
        color: '#ffffff',
        padding: '24px',
        overflowY: 'auto',
        animation: 'sdFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes sdFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes sdGlowPulse {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.03); }
        }
        @keyframes sdShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .sportdata-victory-card {
          width: 100%;
          max-width: 860px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
        }
        .sd-win-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 24px;
          border-radius: 9999px;
          font-weight: 900;
          font-size: clamp(14px, 2.5cqw, 20px);
          letter-spacing: 0.18em;
          text-transform: uppercase;
          background: ${isAka ? 'linear-gradient(90deg, #e11d48, #be123c)' : 'linear-gradient(90deg, #2563eb, #1d4ed8)'};
          box-shadow: 0 0 35px ${isAka ? 'rgba(225, 29, 72, 0.6)' : 'rgba(37, 99, 235, 0.6)'};
          margin-bottom: 16px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          animation: sdGlowPulse 2.5s infinite ease-in-out;
        }
        .sd-athlete-name {
          font-family: var(--font-display, inherit);
          font-size: clamp(32px, 6.5cqw, 64px);
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.02em;
          text-transform: uppercase;
          text-shadow: 0 4px 25px rgba(0, 0, 0, 0.7);
          margin-bottom: 8px;
        }
        .sd-academy-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: clamp(13px, 2cqw, 18px);
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          background: rgba(0, 0, 0, 0.35);
          padding: 6px 18px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          margin-bottom: 24px;
        }
        .sd-score-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 18px;
          padding: 12px 32px;
          margin-bottom: 28px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        }
        .sd-next-panel {
          width: 100%;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          padding: 18px 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
          text-align: left;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
        }
        @media (max-width: 768px) {
          .sportdata-victory-root {
            padding: 16px;
            justify-content: flex-start;
          }
          .sd-next-panel {
            padding: 14px 16px;
          }
          .sd-score-banner {
            padding: 8px 16px;
            gap: 12px;
          }
        }
      `}</style>

      {/* Top action dismiss button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: 'pointer',
            zIndex: 10,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
          title="Dismiss Overlay"
        >
          <X size={20} />
        </button>
      )}

      <div className="sportdata-victory-card">
        {/* Victory Badge */}
        <div className="sd-win-badge">
          <Trophy size={18} />
          <span>{isAka ? '🔴 AKA WINS' : '🔵 AO WINS'}</span>
        </div>

        {/* Winner Athlete Name */}
        <div className="sd-athlete-name">{winnerName}</div>

        {/* Academy / Country / Kata Details */}
        <div className="sd-academy-pill">
          {winnerCountry && <span style={{ fontWeight: 800 }}>{winnerCountry}</span>}
          {winnerCountry && winnerAcademy && <span>•</span>}
          {winnerAcademy && <span>{winnerAcademy}</span>}
          {isKata && kataName && (
            <>
              <span>•</span>
              <span style={{ color: '#fef08a', fontWeight: 700 }}>Kata: {kataName}</span>
            </>
          )}
        </div>

        {/* Score / Flag Display */}
        {finalScore && !isKata && (
          <div className="sd-score-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#f43f5e' }}>AKA</span>
              <span style={{ fontSize: 'clamp(24px, 4cqw, 36px)', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                {finalScore.aka}
              </span>
            </div>
            <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '18px', fontWeight: 700 }}>─</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'clamp(24px, 4cqw, 36px)', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                {finalScore.ao}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#60a5fa' }}>AO</span>
            </div>
            {finalScore.senshuWinner && (
              <span
                style={{
                  marginLeft: '12px',
                  background: '#fbbf24',
                  color: '#000000',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 900,
                  letterSpacing: '0.05em',
                }}
              >
                SENSHU
              </span>
            )}
          </div>
        )}

        {isKata && kataFlags && (
          <div className="sd-score-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#f43f5e' }}>AKA FLAGS</span>
              <span style={{ fontSize: 'clamp(24px, 4cqw, 36px)', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                {kataFlags.aka}
              </span>
            </div>
            <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '18px', fontWeight: 700 }}>─</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'clamp(24px, 4cqw, 36px)', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                {kataFlags.ao}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#60a5fa' }}>AO FLAGS</span>
            </div>
          </div>
        )}

        {/* UP NEXT SECTION */}
        {nextMatch && (
          <div className="sd-next-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    color: '#93c5fd',
                  }}
                >
                  UP NEXT ON MAT
                </span>
                {nextMatch.matchId && (
                  <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                    Match #{nextMatch.matchId}
                  </span>
                )}
                {nextMatch.category && (
                  <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>• {nextMatch.category}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: nextMatch.akaReady && nextMatch.aoReady ? '#4ade80' : '#fcd34d',
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: nextMatch.akaReady && nextMatch.aoReady ? '#4ade80' : '#fcd34d',
                    }}
                  />
                  {nextMatch.akaReady && nextMatch.aoReady ? 'Both Ready' : 'On Standby'}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '12px 16px',
                borderRadius: '12px',
              }}
            >
              {/* AKA Next */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontWeight: 800, fontSize: 'clamp(13px, 1.8cqw, 16px)' }}>{nextMatch.aka}</span>
                </div>
                {nextMatch.akaAcademy && (
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginLeft: '14px' }}>
                    {nextMatch.akaAcademy}
                  </span>
                )}
              </div>

              {/* VS */}
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 900,
                  color: 'rgba(255, 255, 255, 0.4)',
                  letterSpacing: '0.1em',
                }}
              >
                VS
              </div>

              {/* AO Next */}
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: 'clamp(13px, 1.8cqw, 16px)' }}>{nextMatch.ao}</span>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                </div>
                {nextMatch.aoAcademy && (
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginRight: '14px' }}>
                    {nextMatch.aoAcademy}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progress & Quick Action */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '9999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: isAka
                  ? 'linear-gradient(90deg, #f43f5e, #fda4af)'
                  : 'linear-gradient(90deg, #3b82f6, #93c5fd)',
                transition: 'width 1s linear',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
              Loading next match in <strong>{secondsLeft}s</strong>...
            </span>

            {onProceedNextMatch && (
              <button
                type="button"
                onClick={onProceedNextMatch}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
              >
                <span>Load Next Match Now</span>
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
