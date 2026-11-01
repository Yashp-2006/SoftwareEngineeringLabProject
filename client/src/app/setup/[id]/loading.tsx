import { SkStyle, SkPageHeader, SkText, SkRect } from '@/modules/shared/components/PageSkeleton';

// Setup wizard: left sidebar steps + right main panel
export default function SetupLoading() {
  return (
    <>
      <SkStyle />
      <main className="container">
        <SkPageHeader actions={1} />

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24 }}>
          {/* Sidebar steps */}
          <div
            style={{
              background: 'var(--shiro)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0' }}>
                <div className="sk" style={{ width: 28, height: 28, borderRadius: 999 }} />
                <SkText w="65%" h={14} />
              </div>
            ))}
          </div>

          {/* Right panel: form-like content */}
          <div
            style={{
              background: 'var(--shiro)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 12,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            <SkText w="40%" h={22} />
            <SkText w="60%" h={13} />

            {/* 2-col form rows */}
            {[0, 1, 2].map(row => (
              <div key={row} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[0, 1].map(col => (
                  <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <SkText w="40%" h={12} />
                    <SkRect w="100%" h={44} radius={8} />
                  </div>
                ))}
              </div>
            ))}

            {/* Category list area */}
            <SkRect w="100%" h={200} radius={10} />

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <div className="sk" style={{ width: 100, height: 44, borderRadius: 8 }} />
              <div className="sk" style={{ width: 140, height: 44, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
