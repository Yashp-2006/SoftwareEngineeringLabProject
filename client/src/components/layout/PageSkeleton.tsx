import React from 'react';

export default function PageSkeleton({ darkMode = false }: { darkMode?: boolean }) {
  const bg = darkMode ? 'var(--neutral-900)' : 'var(--shiro)';
  const pulseA = darkMode ? 'var(--neutral-800)' : 'var(--neutral-200)';
  const pulseB = darkMode ? 'var(--neutral-700)' : 'var(--neutral-300)';

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', height: '100%', flex: 1, background: bg }}>
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.8; background-color: ${pulseA}; }
          50% { opacity: 0.4; background-color: ${pulseB}; }
        }
        .sk-pulse {
          animation: skeleton-pulse 1.5s ease-in-out infinite;
          border-radius: 12px;
        }
      `}</style>
      
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="sk-pulse" style={{ width: '250px', height: '40px' }}></div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="sk-pulse" style={{ width: '120px', height: '40px', borderRadius: '8px' }}></div>
          <div className="sk-pulse" style={{ width: '120px', height: '40px', borderRadius: '8px' }}></div>
        </div>
      </div>
      
      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="sk-pulse" style={{ height: '120px' }}></div>
        ))}
      </div>
      
      {/* Main Content Area */}
      <div style={{ display: 'flex', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
           <div className="sk-pulse" style={{ height: '300px' }}></div>
           <div className="sk-pulse" style={{ height: '200px' }}></div>
        </div>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
           <div className="sk-pulse" style={{ height: '516px' }}></div>
        </div>
      </div>
    </div>
  );
}
