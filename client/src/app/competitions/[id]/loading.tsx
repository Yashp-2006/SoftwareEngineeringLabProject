import { SkStyle, SkText, SkRect, SkTable } from '@/modules/shared/components/PageSkeleton';

// Mirrors competitions/[id]/layout.tsx sidebar + main panel
export default function CompetitionDetailLoading() {
  return (
    <>
      <SkStyle />
      {/* Competition hero banner */}
      <div
        style={{
          background: 'var(--shiro)',
          borderBottom: '1px solid var(--neutral-200)',
          padding: '24px 32px',
          display: 'flex',
          gap: 24,
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkText w={80} h={11} />
          <SkText w="50%" h={28} />
          <SkText w="35%" h={13} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="sk" style={{ width: 100, height: 36, borderRadius: 8 }} />
          <div className="sk" style={{ width: 120, height: 36, borderRadius: 8 }} />
        </div>
      </div>

      {/* Nav tabs */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          padding: '0 32px',
          borderBottom: '1px solid var(--neutral-200)',
          background: 'var(--shiro)',
          height: 48,
          alignItems: 'flex-end',
        }}
      >
        {[80, 72, 88, 68, 80, 72].map((w, i) => (
          <div key={i} style={{ paddingBottom: 12 }}>
            <div className="sk" style={{ width: w, height: 14, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Main content area */}
      <main className="container" style={{ marginTop: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
          {/* Left: data table */}
          <SkTable rows={6} cols={['5%', '30%', '25%', '20%', '10%', '10%']} />

          {/* Right: info panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[120, 100, 160].map((h, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--shiro)',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 12,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  height: h,
                }}
              >
                <SkText w="50%" h={13} />
                <SkRect w="100%" h={h - 60} radius={8} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
