import { SkStyle, SkPageHeader, SkText, SkRect, SkTable } from '@/modules/shared/components/PageSkeleton';

export default function ArchivesLoading() {
  return (
    <>
      <SkStyle />
      <main className="container">
        <SkPageHeader actions={1} />

        {/* Summary stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: 'var(--shiro)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 12,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <SkText w="60%" h={11} />
              <SkText w="40%" h={36} />
              <SkText w="50%" h={12} />
            </div>
          ))}
        </div>

        {/* Results table */}
        <SkTable rows={8} cols={['5%', '30%', '25%', '15%', '15%', '10%']} />
      </main>
    </>
  );
}
