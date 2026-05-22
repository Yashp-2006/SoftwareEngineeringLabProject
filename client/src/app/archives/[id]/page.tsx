'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { Medal } from 'lucide-react';

export default function ArchiveDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('@lib/firebase');
        
        const catSnap = await getDocs(collection(db, 'competitions', id, 'categories'));
        const cats = [];
        
        for (const doc of catSnap.docs) {
          const matchSnap = await getDocs(collection(db, 'competitions', id, 'categories', doc.id, 'matches'));
          cats.push({
            id: doc.id,
            ...doc.data(),
            matches: matchSnap.docs.map(m => m.data())
          });
        }
        setCategories(cats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  return (
    <main className="container">
      <Header breadcrumbs="TaiKaiX / Archives" title={`View Archives: ${id}`} />
      <div style={{ marginTop: 'var(--space-6)' }}>
        {loading ? (
          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <p style={{ color: 'var(--neutral-500)' }}>Loading archive data...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <p style={{ color: 'var(--neutral-500)' }}>No data found for this competition.</p>
          </div>
        ) : (
          <div className="tiesheet-preview-grid">
            {categories.map((cat, idx) => {
              // Simple check for winner: find the match with highest round
              const finalMatch = cat.matches.sort((a: any, b: any) => b.round - a.round)[0];
              const winner = finalMatch?.winnerId ? (finalMatch.aka?.playerId === finalMatch.winnerId ? finalMatch.aka : finalMatch.ao) : null;
              
              return (
                <div key={idx} className="mat-setup-card">
                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                    <h4>{cat.name}</h4>
                    <span className="status-chip status-done">Finished</span>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--neutral-50)', borderRadius: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-upcoming)', fontWeight: 'bold' }}>
                      <Medal size={20} />
                      {winner ? winner.name : 'Unknown Winner'}
                    </div>
                    {winner && <div className="text-micro" style={{ color: 'var(--neutral-500)', marginLeft: '28px' }}>{winner.country}</div>}
                  </div>
                  <Link href={`/competitions/${id}/bracket`} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                    View Final Bracket
                  </Link>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Link href="/competitions" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            Back to Competitions
          </Link>
        </div>
      </div>
    </main>
  );
}
