import { SkStyle, SkPageHeader, SkBento, SkTable, SkText } from '@/modules/shared/components/PageSkeleton';

export default function DashboardLoading() {
  return (
    <>
      <SkStyle />
      <main className="container">
        <SkPageHeader actions={2} />

        {/* 4 stat cards + wide chart + pie chart */}
        <SkBento
          cards={[
            { span: 3, h: 130 },
            { span: 3, h: 130 },
            { span: 3, h: 130 },
            { span: 3, h: 130 },
            { span: 8, h: 260 },
            { span: 4, h: 260 },
          ]}
        />

        {/* Live competition stream table */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <SkText w={200} h={20} />
            <div className="sk" style={{ width: 120, height: 36, borderRadius: 8 }} />
          </div>
          <SkTable rows={4} cols={['30%', '25%', '15%', '15%', '15%']} />
        </div>
      </main>
    </>
  );
}
