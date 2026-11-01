import { SkStyle, SkPageHeader, SkRect, SkText } from '@/modules/shared/components/PageSkeleton';

// Matches the comp-grid: 3-column card grid
function SkCompCard() {
  return (
    <div
      style={{
        background: 'var(--shiro)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 14,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sk" style={{ width: 72, height: 22, borderRadius: 20 }} />
        <div className="sk" style={{ width: 48, height: 14, borderRadius: 4 }} />
      </div>
      <SkText w="75%" h={22} />
      <SkText w="55%" h={13} />
      <div style={{ display: 'flex', gap: 24, paddingTop: 16, borderTop: '1px solid var(--neutral-100)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="sk" style={{ width: 60, height: 11, borderRadius: 3 }} />
          <div className="sk" style={{ width: 28, height: 18, borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="sk" style={{ width: 60, height: 11, borderRadius: 3 }} />
          <div className="sk" style={{ width: 28, height: 18, borderRadius: 4 }} />
        </div>
      </div>
      <div className="sk" style={{ width: '100%', height: 40, borderRadius: 8 }} />
    </div>
  );
}

export default function CompetitionsLoading() {
  return (
    <>
      <SkStyle />
      {/* Sub-nav placeholder */}
      <div style={{ height: 56, borderBottom: '1px solid var(--neutral-200)', background: 'var(--shiro)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 24 }}>
        {[80, 48, 80, 72].map((w, i) => (
          <div key={i} className="sk" style={{ width: w, height: 14, borderRadius: 4 }} />
        ))}
      </div>
      <main className="container">
        <SkPageHeader actions={1} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkCompCard key={i} />
          ))}
        </div>
      </main>
    </>
  );
}
