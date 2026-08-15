'use client';

import React, { useState } from 'react';

const FOUL_CODES = [
  { code: 'ANNOUNCE_EARLY', label: 'Kata announced before bow' },
  { code: 'MINOR_BALANCE', label: 'Minor loss of balance' },
  { code: 'INCOMPLETE_TECH', label: 'Incorrect/incomplete movement' },
  { code: 'ASYNC', label: 'Asynchronous movement (team out of sync)' },
  { code: 'AUDIBLE_CUE', label: 'Audible cue from outside' },
  { code: 'THEATRICS', label: 'Stamping / slapping / inappropriate exhalation' },
  { code: 'WRONG_KIAI', label: 'Incorrect Kiai' },
  { code: 'BELT_LOOSE', label: 'Belt loose / coming off hips' },
  { code: 'TIME_WASTE', label: 'Time wasting / exceeded 35-second start window' },
  { code: 'BUNKAI_INJURY', label: 'Injury from lack of control in Bunkai' },
  { code: 'UNCONSCIOUS_2S', label: 'Simulated unconsciousness >2 seconds in Bunkai' },
];

interface FoulPanelProps {
  fouls: { aka: string[]; ao: string[] };
  onLogFoul: (side: 'aka' | 'ao', code: string) => void;
  disabled?: boolean;
}

export default function FoulPanel({ fouls, onLogFoul, disabled }: FoulPanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<'aka' | 'ao'>('aka');
  const [selectedCode, setSelectedCode] = useState('');

  const totalFouls = fouls.aka.length + fouls.ao.length;

  return (
    <div
      style={{
        border: '1px solid var(--neutral-200)',
        borderRadius: '12px',
        overflow: 'hidden',
        marginTop: '12px',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: open ? 'var(--neutral-50)' : 'var(--shiro)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 700,
          fontSize: '13px',
          color: 'var(--neutral-800)',
        }}
      >
        <span>Fouls Panel</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {totalFouls > 0 && (
            <span
              style={{
                background: '#fef3c7',
                color: '#92400e',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 800,
              }}
            >
              {totalFouls} foul{totalFouls !== 1 ? 's' : ''}
            </span>
          )}
          <span style={{ fontSize: '12px', opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--neutral-100)' }}>
          {/* Log new foul */}
          {!disabled && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <select
                value={selectedSide}
                onChange={(e) => setSelectedSide(e.target.value as 'aka' | 'ao')}
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--neutral-300)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: selectedSide === 'aka' ? 'var(--aka)' : 'var(--ao)',
                  cursor: 'pointer',
                }}
              >
                <option value="aka">AKA</option>
                <option value="ao">AO</option>
              </select>

              <select
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  border: '1px solid var(--neutral-300)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  minWidth: '200px',
                }}
              >
                <option value="">Select foul code…</option>
                {FOUL_CODES.map((f) => (
                  <option key={f.code} value={f.code}>
                    [{f.code}] {f.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!selectedCode}
                onClick={() => {
                  if (selectedCode) {
                    onLogFoul(selectedSide, selectedCode);
                    setSelectedCode('');
                  }
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: selectedCode ? '#d97706' : 'var(--neutral-200)',
                  color: selectedCode ? '#fff' : 'var(--neutral-400)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: selectedCode ? 'pointer' : 'not-allowed',
                }}
              >
                Log Foul
              </button>
            </div>
          )}

          {/* Logged fouls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {(['aka', 'ao'] as const).map((side) => (
              <div key={side}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: side === 'aka' ? 'var(--aka)' : 'var(--ao)',
                    marginBottom: '8px',
                    letterSpacing: '0.06em',
                  }}
                >
                  {side.toUpperCase()} Fouls
                </div>
                {fouls[side].length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--neutral-400)' }}>No fouls logged</div>
                ) : (
                  fouls[side].map((code, i) => {
                    const foul = FOUL_CODES.find((f) => f.code === code);
                    return (
                      <div
                        key={i}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          background: '#fef9c3',
                          border: '1px solid #fef08a',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          fontWeight: 600,
                        }}
                      >
                        {foul ? foul.label : code}
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
