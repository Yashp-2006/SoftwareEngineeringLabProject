import { SkStyle, SkPageHeader, SkTable } from '@/modules/shared/components/PageSkeleton';

export default function UsersLoading() {
  return (
    <>
      <SkStyle />
      <main className="container">
        <SkPageHeader actions={0} />

        {/* Search + filter bar */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginBottom: 24,
            padding: '16px 24px',
            background: 'var(--shiro)',
            border: '1px solid var(--neutral-200)',
            borderRadius: '12px 12px 0 0',
          }}
        >
          <div className="sk" style={{ flex: 1, height: 40, borderRadius: 8 }} />
          <div className="sk" style={{ width: 220, height: 40, borderRadius: 8 }} />
        </div>

        {/* Users table — 4 cols: Name, Email, Role, Status */}
        <SkTable
          rows={8}
          cols={['28%', '32%', '30%', '10%']}
        />
      </main>
    </>
  );
}
