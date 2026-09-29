/**
 * PageSkeleton — shared skeleton primitives for TaikaiX loading states.
 * Pure CSS shimmer, no JS animation, no new deps.
 * Used by every route's loading.tsx.
 */

import React from 'react';

const SHIMMER_CSS = `
  @keyframes sk-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .sk {
    background: linear-gradient(
      90deg,
      var(--neutral-200) 25%,
      var(--neutral-100) 50%,
      var(--neutral-200) 75%
    );
    background-size: 800px 100%;
    animation: sk-shimmer 1.4s ease-in-out infinite;
    border-radius: 6px;
    flex-shrink: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .sk { animation: none; background: var(--neutral-200); }
  }
`;

/** Injects shimmer CSS once — safe to call from multiple components */
export function SkStyle() {
  return <style dangerouslySetInnerHTML={{ __html: SHIMMER_CSS }} />;
}

/** Base shimmer block */
export function Sk({
  w = '100%',
  h = 16,
  radius = 6,
  style,
}: {
  w?: number | string;
  h?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="sk"
      style={{ width: w, height: h, borderRadius: radius, ...style }}
    />
  );
}

/** Skeleton text line — width controls visual "length" of the line */
export function SkText({ w = '60%', h = 14 }: { w?: string | number; h?: number }) {
  return <Sk w={w} h={h} radius={4} />;
}

/** Full rectangle placeholder (images, chart areas, large blocks) */
export function SkRect({ w = '100%', h = 120, radius = 10 }: { w?: string | number; h?: number; radius?: number }) {
  return <Sk w={w} h={h} radius={radius} />;
}

/** Circle placeholder (avatars, icons) */
export function SkCircle({ size = 40 }: { size?: number }) {
  return <Sk w={size} h={size} radius={999} />;
}

/** Standard page-header skeleton matching .page-header layout */
export function SkPageHeader({ actions = 1 }: { actions?: number }) {
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 24,
        marginBottom: 24,
        borderBottom: '1px solid var(--neutral-200)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkText w={100} h={11} />
        <SkText w={200} h={32} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {Array.from({ length: actions }).map((_, i) => (
          <SkRect key={i} w={120} h={40} radius={8} />
        ))}
      </div>
    </header>
  );
}

/** White card skeleton with border — matches .card / .bento-card */
export function SkCard({
  h = 140,
  gridColumn,
}: {
  h?: number;
  gridColumn?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--shiro)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: h,
        gridColumn,
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <SkCircle size={32} />
        <SkText w="40%" h={13} />
      </div>
      <SkText w="30%" h={40} />
      <SkText w="55%" h={12} />
    </div>
  );
}

/** Table body skeleton — n rows × col widths */
export function SkTable({
  rows = 5,
  cols = ['30%', '25%', '15%', '15%', '15%'],
}: {
  rows?: number;
  cols?: string[];
}) {
  return (
    <div
      style={{
        background: 'var(--shiro)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* thead placeholder */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '14px 24px',
          background: 'var(--neutral-50)',
          borderBottom: '1px solid var(--neutral-300)',
        }}
      >
        {cols.map((w, i) => (
          <div key={i} style={{ width: w, paddingRight: 16 }}>
            <SkText w="70%" h={11} />
          </div>
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div
          key={ri}
          style={{
            display: 'flex',
            padding: '18px 24px',
            borderBottom: ri < rows - 1 ? '1px solid var(--neutral-200)' : 'none',
            alignItems: 'center',
            gap: 0,
          }}
        >
          {cols.map((w, ci) => (
            <div key={ci} style={{ width: w, paddingRight: 16 }}>
              <SkText
                w={ci === 0 ? '80%' : ci === cols.length - 1 ? '50%' : '65%'}
                h={ci === 0 ? 14 : 13}
              />
              {ci === 0 && (
                <div style={{ marginTop: 6 }}>
                  <SkText w="50%" h={12} />
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Bento grid skeleton — pass column spans as array */
export function SkBento({
  cards,
}: {
  cards: Array<{ span?: number; h?: number }>;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}
    >
      {cards.map(({ span = 3, h = 140 }, i) => (
        <div key={i} style={{ gridColumn: `span ${span}` }}>
          <SkCard h={h} />
        </div>
      ))}
    </div>
  );
}
