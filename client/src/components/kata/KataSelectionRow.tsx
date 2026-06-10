'use client';

import React, { useState, useMemo } from 'react';
import { KATA_LIST, KataEntry } from '@/lib/kata-list';

interface KataSelectionRowProps {
  side: 'aka' | 'ao';
  allowedKataNumbers: number[];
  selectedKata: KataEntry | null;
  usageMap: Record<number, number>; // katanumber -> times used by this athlete
  onSelect: (kata: KataEntry | null) => void;
  disabled?: boolean;
}

export default function KataSelectionRow({
  side,
  allowedKataNumbers,
  selectedKata,
  usageMap,
  onSelect,
  disabled,
}: KataSelectionRowProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const allowedKata = useMemo(
    () => KATA_LIST.filter((k) => allowedKataNumbers.includes(k.number)),
    [allowedKataNumbers]
  );

  const allUsedTwice = allowedKata.every((k) => (usageMap[k.number] ?? 0) >= 2);

  const filtered = allowedKata.filter(
    (k) =>
      k.name.toLowerCase().includes(search.toLowerCase()) ||
      String(k.number).includes(search)
  );

  const colorVar = side === 'aka' ? 'var(--aka)' : 'var(--ao)';
  const label = side.toUpperCase();

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: colorVar,
          marginBottom: '6px',
        }}
      >
        {label} — Kata Selection
      </div>

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          padding: '10px 14px',
          border: `1.5px solid ${selectedKata ? colorVar : 'var(--neutral-300)'}`,
          borderRadius: '8px',
          background: selectedKata ? (side === 'aka' ? 'rgba(217,38,44,0.05)' : 'rgba(26,77,181,0.05)') : 'var(--shiro)',
          textAlign: 'left',
          fontWeight: 700,
          fontSize: '14px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: selectedKata ? colorVar : 'var(--neutral-500)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{selectedKata ? `#${selectedKata.number} — ${selectedKata.name}` : 'Select Kata…'}</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
      </button>

      {selectedKata && (
        <div
          style={{
            marginTop: '4px',
            fontSize: '11px',
            fontWeight: 700,
            color: colorVar,
            paddingLeft: '2px',
          }}
        >
          Using kata #{selectedKata.number} — {selectedKata.name}
        </div>
      )}

      {/* Dropdown */}
      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 200,
            background: 'var(--shiro)',
            border: '1px solid var(--neutral-200)',
            borderRadius: '10px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.12)',
            marginTop: '4px',
            maxHeight: '320px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--neutral-100)' }}>
            <input
              autoFocus
              type="text"
              placeholder="Search kata…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid var(--neutral-300)',
                borderRadius: '6px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {allUsedTwice && (
            <div
              style={{
                padding: '8px 12px',
                background: '#fffbeb',
                borderBottom: '1px solid #fef3c7',
                fontSize: '12px',
                color: '#92400e',
                fontWeight: 600,
              }}
            >
              ⚠ All permitted kata used twice. Free selection allowed.
            </div>
          )}

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {/* Clear selection */}
            <div
              onClick={() => { onSelect(null); setOpen(false); }}
              style={{
                padding: '10px 14px',
                fontSize: '13px',
                color: 'var(--neutral-500)',
                cursor: 'pointer',
                borderBottom: '1px solid var(--neutral-50)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--neutral-50)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              — None
            </div>

            {filtered.map((kata) => {
              const uses = usageMap[kata.number] ?? 0;
              const isDisabled = !allUsedTwice && uses >= 2;
              const usedOnce = uses === 1;

              return (
                <div
                  key={kata.number}
                  onClick={() => {
                    if (!isDisabled) {
                      onSelect(kata);
                      setOpen(false);
                    }
                  }}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--neutral-50)',
                    background: selectedKata?.number === kata.number ? (side === 'aka' ? 'rgba(217,38,44,0.06)' : 'rgba(26,77,181,0.06)') : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!isDisabled) e.currentTarget.style.background = 'var(--neutral-50)'; }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      selectedKata?.number === kata.number ? (side === 'aka' ? 'rgba(217,38,44,0.06)' : 'rgba(26,77,181,0.06)') : 'transparent';
                  }}
                >
                  <span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--neutral-400)', marginRight: '8px', fontSize: '11px' }}>
                      #{kata.number}
                    </span>
                    <strong>{kata.name}</strong>
                  </span>
                  {usedOnce && (
                    <span style={{ fontSize: '10px', color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      used 1×
                    </span>
                  )}
                  {isDisabled && (
                    <span style={{ fontSize: '10px', color: 'var(--neutral-400)', fontWeight: 600 }}>
                      used 2× (max)
                    </span>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--neutral-400)', fontSize: '13px' }}>
                No kata match search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
