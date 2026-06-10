'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';

const DQ_REASONS = [
  'Wrong / unannounced kata',
  'No bow at start or end',
  'Not facing judges at start',
  'Distinct pause or stop',
  'Omitted / added / changed movements',
  'Persistent theatrics',
  'Corrective step or fall from balance loss',
  'Belt fell off',
  'Time limit exceeded (5 min — teams only)',
  'Jodan Kani Basami in Bunkai',
  'SHIKKAKU / misconduct',
];

interface DQPanelProps {
  isDQ: { aka: boolean; ao: boolean };
  akaName: string;
  aoName: string;
  onDQ: (side: 'aka' | 'ao', reason: string) => void;
  disabled?: boolean;
}

export default function DQPanel({ isDQ, akaName, aoName, onDQ, disabled }: DQPanelProps) {
  const [showModal, setShowModal] = useState<'aka' | 'ao' | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [shugoConfirmed, setShugoConfirmed] = useState(false);

  const handleConfirmDQ = () => {
    if (!showModal || !selectedReason || !shugoConfirmed) return;
    onDQ(showModal, selectedReason);
    setShowModal(null);
    setSelectedReason('');
    setShugoConfirmed(false);
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
        {(['aka', 'ao'] as const).map((side) => (
          <button
            key={side}
            type="button"
            disabled={disabled || isDQ[side]}
            onClick={() => { setShowModal(side); setSelectedReason(''); setShugoConfirmed(false); }}
            style={{
              padding: '10px 16px',
              border: `2px solid ${isDQ[side] ? 'var(--neutral-300)' : (side === 'aka' ? 'rgba(217,38,44,0.4)' : 'rgba(26,77,181,0.4)')}`,
              borderRadius: '8px',
              background: isDQ[side] ? 'var(--neutral-100)' : (side === 'aka' ? 'rgba(217,38,44,0.06)' : 'rgba(26,77,181,0.06)'),
              color: isDQ[side] ? 'var(--neutral-400)' : (side === 'aka' ? 'var(--aka)' : 'var(--ao)'),
              fontWeight: 800,
              fontSize: '13px',
              cursor: (disabled || isDQ[side]) ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isDQ[side] ? (
              <>
                <span style={{ display: 'inline-flex' }}><X size={16} /></span>
                <span>{side.toUpperCase()} DISQUALIFIED</span>
              </>
            ) : (
              <>
                <span style={{ display: 'inline-flex' }}><AlertTriangle size={16} /></span>
                <span>Disqualify {side.toUpperCase()}</span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* DQ Confirmation Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--shiro)',
              width: '520px',
              maxWidth: '95vw',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--neutral-200)',
                background: showModal === 'aka' ? 'rgba(217,38,44,0.08)' : 'rgba(26,77,181,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: showModal === 'aka' ? 'var(--aka)' : 'var(--ao)',
                    letterSpacing: '0.08em',
                    marginBottom: '2px',
                  }}
                >
                  Disqualification — Article 5.8
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>
                  Disqualify {showModal === 'aka' ? akaName : aoName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--neutral-500)' }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--neutral-700)', display: 'block', marginBottom: '8px' }}>
                  Select DQ Reason
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1.5px solid var(--neutral-300)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Choose a reason…</option>
                  {DQ_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  padding: '12px 16px',
                  background: '#fef9c3',
                  border: '1px solid #fef08a',
                  borderRadius: '8px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#92400e',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={shugoConfirmed}
                    onChange={(e) => setShugoConfirmed(e.target.checked)}
                    style={{ marginTop: '2px', flexShrink: 0 }}
                  />
                  <span>
                    Chief Judge has called <strong>Shugo</strong> <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                    <div style={{ fontSize: '11px', fontWeight: 500, marginTop: '2px', color: '#b45309' }}>
                      DQ cannot be committed without Chief Judge's call
                    </div>
                  </span>
                </label>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#991b1b',
                  fontWeight: 600,
                }}
              >
                <AlertTriangle size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '4px' }} /> This action awards the bout to the opponent and sets all judge scores to 0.0. This cannot be undone.
              </div>
            </div>

            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--neutral-200)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                background: 'var(--neutral-50)',
              }}
            >
              <button
                type="button"
                onClick={() => setShowModal(null)}
                style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--neutral-300)', background: 'var(--shiro)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedReason || !shugoConfirmed}
                onClick={handleConfirmDQ}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: (!selectedReason || !shugoConfirmed) ? 'var(--neutral-300)' : 'var(--aka)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: (!selectedReason || !shugoConfirmed) ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Confirm DQ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
