import { SkStyle, SkRect, SkText, SkCircle } from '@/modules/shared/components/PageSkeleton';

export default function ProfileLoading() {
  return (
    <>
      <SkStyle />
      <main className="container">
        {/* page-header */}
        <header style={{ paddingBottom: 24, marginBottom: 24, borderBottom: '1px solid var(--neutral-200)' }}>
          <SkText w={160} h={11} />
          <div style={{ marginTop: 8 }}>
            <SkText w={140} h={32} />
          </div>
        </header>

        {/* profile-header card */}
        <section
          style={{
            background: 'var(--shiro)',
            border: '1px solid var(--neutral-200)',
            borderRadius: 12,
            padding: 32,
            display: 'flex',
            gap: 32,
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <SkCircle size={120} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SkText w="30%" h={28} />
            <div style={{ display: 'flex', gap: 24 }}>
              <SkText w={180} h={14} />
              <SkText w={100} h={14} />
            </div>
          </div>
          <div className="sk" style={{ width: 120, height: 40, borderRadius: 8, flexShrink: 0 }} />
        </section>

        {/* stats-row — 2 cards */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {[0, 1].map(i => (
            <div
              key={i}
              style={{
                background: 'var(--shiro)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 10,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <SkText w={60} h={32} />
              <SkText w={100} h={11} />
            </div>
          ))}
        </section>

        {/* Competition history list */}
        <section>
          <SkText w={220} h={24} style={{ marginBottom: 20 }} />
          <div style={{ display: 'grid', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--shiro)',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <SkRect w={50} h={50} radius={8} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <SkText w={180} h={15} />
                    <SkText w={120} h={13} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="sk" style={{ width: 72, height: 24, borderRadius: 20 }} />
                  <div className="sk" style={{ width: 36, height: 36, borderRadius: 8 }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
