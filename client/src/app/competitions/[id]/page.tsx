'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { Lock, Unlock, Users, Calendar, Layout, Award, Edit3, Share2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function CompetitionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const searchParams = useSearchParams();
  const { user, role } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');

  const [compData, setCompData] = useState<any>(null);

  // Admins or users with join link bypass passcode
  useEffect(() => {
    if (user || searchParams.get('join') === 'true') {
      setIsAuthenticated(true);
    }
  }, [user, searchParams]);

  useEffect(() => {
    const fetchComp = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { doc, getDoc } = await import('firebase/firestore');
        const d = await getDoc(doc(db, 'competitions', id));
        if (d.exists()) {
          setCompData(d.data());
        }
      } catch (err) {
        console.error("Failed to load competition", err);
      }
    };
    fetchComp();
  }, [id]);

  const handleShareLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/competitions/${id}?join=true`;
      navigator.clipboard.writeText(url);
      toast.success('Public join link copied to clipboard!');
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)' }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: 'var(--space-6)' }}>
          <Lock style={{ width: '48px', height: '48px', color: 'var(--neutral-400)', margin: '0 auto var(--space-4)' }} />
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Private Event</h2>
          <p className="text-small" style={{ marginBottom: 'var(--space-5)' }}>Please use the public join link provided by the tournament organizer to view live results.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Overview
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h1>{compData?.name || id}</h1>
            <span className={`status-chip status-${compData?.status || 'live'}`}>
              {compData?.status === 'done' ? 'Completed' : compData?.status === 'upcoming' ? 'Upcoming' : 'Live'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {role === 'admin' && (
            <>
              <button className="btn btn-secondary" onClick={handleShareLink}>
                <Share2 size={16} style={{ marginRight: '8px' }} /> Share Join Link
              </button>
              <Link href={`/setup/${id}`} className="btn btn-primary">
                <Edit3 size={16} /> Setup Wizard
              </Link>
            </>
          )}
          {(role === 'admin' || role === 'mat_operator') && (
            <button className="btn btn-primary">
              <Layout size={16} style={{ marginRight: '8px' }} /> Start Next Match
            </button>
          )}
        </div>
      </header>

      <div className="bento-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <div className="card bento-tile">
          <div className="text-micro">Total Entries</div>
          <div className="display-large">{compData?.athletesCount || 'N/A'}</div>
          <div className="text-small">{compData?.categoriesCount || 0} categories</div>
        </div>
        <div className="card bento-tile">
          <div className="text-micro">Active Mats</div>
          <div className="display-large" style={{ color: 'var(--aka)' }}>{compData?.mats || 'N/A'}</div>
          <div className="text-small">Configured capacity</div>
        </div>
        <div className="card bento-tile">
          <div className="text-micro">Matches Completed</div>
          <div className="display-large">0</div>
          <div className="text-small">0% of tournament</div>
        </div>
        <div className="card bento-tile">
          <div className="text-micro">Est. Finish Time</div>
          <div className="display-large">N/A</div>
          <div className="text-small">Not started</div>
        </div>
      </div>

      <section style={{ marginTop: 'var(--space-4)' }}>
        <div className="flex-between" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <h2>Recent Results</h2>
          <button className="btn btn-ghost">View All</button>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-300)' }}>
              <tr>
                <th className="text-micro" style={{ padding: '12px 24px', textAlign: 'left' }}>Category</th>
                <th className="text-micro" style={{ padding: '12px 24px', textAlign: 'left' }}>Aka (Red)</th>
                <th className="text-micro" style={{ padding: '12px 24px', textAlign: 'left' }}>Ao (Blue)</th>
                <th className="text-micro" style={{ padding: '12px 24px', textAlign: 'center' }}>Score</th>
                <th className="text-micro" style={{ padding: '12px 24px', textAlign: 'right' }}>Winner</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                  No matches completed yet.
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </main>
  );
}
