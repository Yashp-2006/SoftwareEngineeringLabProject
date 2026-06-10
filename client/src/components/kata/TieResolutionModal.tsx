'use client';

import React, { useState } from 'react';

interface TieResolutionModalProps {
  isOpen: boolean;
  akaName: string;
  aoName: string;
  kataFormat: 'elimination' | 'round-robin' | 'two-pool';
  isTeam?: boolean;
  // Pre-computed values (auto-resolved steps)
  akaVictoryPoints?: number;
  aoVictoryPoints?: number;
  headToHeadWinner?: 'aka' | 'ao' | null;
  akaCumulativeVotes?: number;
  aoCumulativeVotes?: number;
  onResolve: (winner: 'aka' | 'ao', method: string) => void;
  onCreateTieBreaker: () => void;
  onClose: () => void;
}

type StepResult = 'aka' | 'ao' | 'tied' | 'pending';

export default function TieResolutionModal({
  isOpen,
  akaName,
  aoName,
  kataFormat,
  isTeam,
  akaVictoryPoints = 0,
  aoVictoryPoints = 0,
  headToHeadWinner = null,
  akaCumulativeVotes = 0,
  aoCumulativeVotes = 0,
  onResolve,
  onCreateTieBreaker,
  onClose,
}: TieResolutionModalProps) {
  const [step, setStep] = useState(0);
  const [akaRanking, setAkaRanking] = useState('');
  const [aoRanking, setAoRanking] = useState('');

  if (!isOpen) return null;

  // Build steps array based on format
  const steps: { label: string; auto: boolean; result?: StepResult; description: string }[] =
    kataFormat === 'elimination'
      ? [
          {
            label: 'Extra Kata Performance',
            auto: false,
            description: 'Majority vote is the sole criterion for elimination. A tie here requires an extra kata bout.',
          },
        ]
      : isTeam
      ? [
          {
            label: '1. Victory Points',
            auto: true,
            result: akaVictoryPoints > aoVictoryPoints ? 'aka' : aoVictoryPoints > akaVictoryPoints ? 'ao' : 'tied',
            description: `Total victory points across all group bouts — AKA: ${akaVictoryPoints} pts, AO: ${aoVictoryPoints} pts`,
          },
          {
            label: '2. Head-to-Head',
            auto: true,
            result: headToHeadWinner ?? 'tied',
            description: 'Result of the direct bout between the two tied teams.',
          },
          {
            label: '3. Cumulative Judge Votes',
            auto: true,
            result: akaCumulativeVotes > aoCumulativeVotes ? 'aka' : aoCumulativeVotes > akaCumulativeVotes ? 'ao' : 'tied',
            description: `Total judge votes across all group bouts — AKA: ${akaCumulativeVotes}, AO: ${aoCumulativeVotes}`,
          },
          {
            label: '4. Extra Kata (No Bunkai)',
            auto: false,
            description: 'Schedule an extra kata performance. Bunkai is not required for this tiebreaker.',
          },
        ]
      : [
          {
            label: '1. Victory Points',
            auto: true,
            result: akaVictoryPoints > aoVictoryPoints ? 'aka' : aoVictoryPoints > akaVictoryPoints ? 'ao' : 'tied',
            description: `Total victory points across all group bouts — AKA: ${akaVictoryPoints} pts, AO: ${aoVictoryPoints} pts`,
          },
          {
            label: '2. Head-to-Head',
            auto: true,
            result: headToHeadWinner ?? 'tied',
            description: 'Result of the direct bout between the two tied athletes.',
          },
          {
            label: '3. Cumulative Judge Votes',
            auto: true,
            result: akaCumulativeVotes > aoCumulativeVotes ? 'aka' : aoCumulativeVotes > akaCumulativeVotes ? 'ao' : 'tied',
            description: `Total judge votes across all group bouts — AKA: ${akaCumulativeVotes}, AO: ${aoCumulativeVotes}`,
          },
          {
            label: '4. WKF World Ranking',
            auto: false,
            description: 'Enter each athlete\'s current WKF World Ranking. Lower number = higher rank.',
          },
          {
            label: '5. Extra Kata Performance',
            auto: false,
            description: 'Schedule an extra kata performance bout.',
          },
        ];

  const currentStep = steps[step];

  const getResultColor = (result?: StepResult) => {
    if (result === 'aka') return 'var(--aka)';
    if (result === 'ao') return 'var(--ao)';
    if (result === 'tied') return '#d97706';
    return 'var(--neutral-400)';
  };

  const getResultLabel = (result?: StepResult, isAkaLabel?: boolean) => {
    if (result === 'tied') return 'Still Tied';
    if (result === 'aka') return isAkaLabel ? '✓ Resolves: AKA Wins' : akaName + ' wins';
    if (result === 'ao') return isAkaLabel ? '✓ Resolves: AO Wins' : aoName + ' wins';
    return '';
  };

  const handleAutoStepResult = (result: StepResult) => {
    if (result === 'aka') {
      onResolve('aka', currentStep.label);
    } else if (result === 'ao') {
      onResolve('ao', currentStep.label);
    } else {
      setStep((s) => Math.min(s + 1, steps.length - 1));
    }
  };

  const handleRankingResolve = () => {
    const akaR = parseInt(akaRanking);
    const aoR = parseInt(aoRanking);
    if (!akaR || !aoR) return;
    if (akaR < aoR) onResolve('aka', 'WKF World Ranking');
    else if (aoR < akaR) onResolve('ao', 'WKF World Ranking');
    else setStep((s) => s + 1);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--shiro)',
          width: '580px',
          maxWidth: '100%',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fff7ed 100%)',
            borderBottom: '1px solid #fde68a',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f59e0b',
                  color: '#fff',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                ⚖ Tie — Resolution Required
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--neutral-900)' }}>
                {akaName} vs {aoName}
              </div>
              <div style={{ fontSize: '12px', color: '#92400e', marginTop: '2px', fontWeight: 600 }}>
                {kataFormat === 'elimination' ? 'Elimination' : kataFormat === 'round-robin' ? 'Round-Robin' : 'Two-Pool'} format
                {isTeam ? ' · Team' : ' · Individual'}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(0,0,0,0.08)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#92400e',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Step progress */}
        {steps.length > 1 && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {steps.map((s, i) => {
              const past = i < step;
              const active = i === step;
              return (
                <div
                  key={i}
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: past ? 'var(--neutral-100)' : active ? 'var(--ao)' : 'transparent',
                    color: past ? 'var(--neutral-500)' : active ? '#fff' : 'var(--neutral-400)',
                    border: `1px solid ${past ? 'var(--neutral-200)' : active ? 'var(--ao)' : 'var(--neutral-200)'}`,
                    textDecoration: past ? 'line-through' : 'none',
                  }}
                >
                  {s.label}
                </div>
              );
            })}
          </div>
        )}

        {/* Current step body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--neutral-900)', marginBottom: '6px' }}>
              {currentStep.label}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--neutral-600)', lineHeight: 1.5 }}>
              {currentStep.description}
            </div>
          </div>

          {/* Auto-resolved step */}
          {currentStep.auto && currentStep.result && (
            <div
              style={{
                padding: '16px',
                background: currentStep.result === 'tied' ? '#fffbeb' : currentStep.result === 'aka' ? 'rgba(217,38,44,0.06)' : 'rgba(26,77,181,0.06)',
                border: `1.5px solid ${getResultColor(currentStep.result)}`,
                borderRadius: '12px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: getResultColor(currentStep.result), textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                {currentStep.result === 'tied' ? '⚖ Still Tied' : `✓ ${getResultLabel(currentStep.result)}`}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--neutral-700)', fontWeight: 600 }}>
                {currentStep.result === 'tied'
                  ? 'Both athletes are equal on this criterion. Proceeding to next step.'
                  : `This criterion resolves the tie. Click to confirm the winner.`}
              </div>
            </div>
          )}

          {/* WKF Ranking input step */}
          {!currentStep.auto && currentStep.label.includes('Ranking') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--aka)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  {akaName} — WKF Ranking
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 12"
                  value={akaRanking}
                  onChange={(e) => setAkaRanking(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1.5px solid rgba(217,38,44,0.3)',
                    borderRadius: '8px',
                    fontSize: '18px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--ao)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  {aoName} — WKF Ranking
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 7"
                  value={aoRanking}
                  onChange={(e) => setAoRanking(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1.5px solid rgba(26,77,181,0.3)',
                    borderRadius: '8px',
                    fontSize: '18px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: 'var(--neutral-500)', fontWeight: 600 }}>
                Lower number = higher WKF rank. The higher-ranked athlete wins.
              </div>
            </div>
          )}

          {/* Extra Kata step */}
          {!currentStep.auto && currentStep.label.toLowerCase().includes('extra kata') && (
            <div
              style={{
                padding: '16px',
                background: 'var(--neutral-50)',
                border: '1px solid var(--neutral-200)',
                borderRadius: '12px',
                marginBottom: '12px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--neutral-800)', marginBottom: '8px' }}>
                Creating an extra kata bout will:
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: '13px', color: 'var(--neutral-600)', lineHeight: 2 }}>
                <li>Push a new match to the top of the queue, flagged as <strong>Tie-Breaker</strong></li>
                <li>Apply the same kata repetition rules</li>
                <li>Run through the full score entry flow</li>
                {isTeam && <li>Bunkai is <strong>not required</strong> for this tiebreaker</li>}
              </ul>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--neutral-100)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            background: 'var(--neutral-50)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--neutral-300)',
              background: 'var(--shiro)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--neutral-700)',
              transition: 'transform 160ms ease-out',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Defer
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {currentStep.auto && currentStep.result === 'tied' && (
              <button
                type="button"
                onClick={() => handleAutoStepResult('tied')}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--ao)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'transform 160ms ease-out',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                Next Step →
              </button>
            )}

            {currentStep.auto && currentStep.result && currentStep.result !== 'tied' && (
              <button
                type="button"
                onClick={() => handleAutoStepResult(currentStep.result!)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: currentStep.result === 'aka' ? 'var(--aka)' : 'var(--ao)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  transition: 'transform 160ms ease-out',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                Confirm {currentStep.result === 'aka' ? akaName : aoName} Wins
              </button>
            )}

            {!currentStep.auto && currentStep.label.includes('Ranking') && (
              <button
                type="button"
                disabled={!akaRanking || !aoRanking}
                onClick={handleRankingResolve}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: akaRanking && aoRanking ? 'var(--neutral-900)' : 'var(--neutral-300)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: akaRanking && aoRanking ? 'pointer' : 'not-allowed',
                  transition: 'transform 160ms ease-out',
                }}
                onMouseDown={(e) => { if (akaRanking && aoRanking) e.currentTarget.style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                Apply Rankings
              </button>
            )}

            {!currentStep.auto && currentStep.label.toLowerCase().includes('extra kata') && (
              <button
                type="button"
                onClick={onCreateTieBreaker}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#f59e0b',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  transition: 'transform 160ms ease-out',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                Create Extra Kata Bout
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
