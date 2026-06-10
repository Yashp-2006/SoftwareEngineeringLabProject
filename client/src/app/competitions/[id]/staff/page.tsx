'use client';

import React from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import StaffAssignmentManager from '@/components/StaffAssignmentManager';

export default function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  return (
    <main className="container">
      <header className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Staff
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h1>Live Staff Coverage</h1>
            <span className="status-chip status-live">Live</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} style={{ marginRight: '6px' }} /> Sync Roster
          </button>
        </div>
      </header>

      <StaffAssignmentManager competitionId={id} />
    </main>
  );
}
