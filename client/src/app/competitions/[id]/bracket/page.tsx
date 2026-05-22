'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import FullscreenBracketModal from '@/components/FullscreenBracketModal';
import { Eye, Trophy, Target, Clock } from 'lucide-react';

export default function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [categories, setCategories] = useState<any[]>([]);
  const [mats, setMats] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Fetch categories with their match data
  useEffect(() => {
    const q = query(collection(db, 'competitions', id, 'categories'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      // Sort: live first, then upcoming, then by name
      cats.sort((a, b) => {
        const order = { live: 0, upcoming: 1, completed: 2 };
        const ao = order[a.status as keyof typeof order] ?? 1;
        const bo = order[b.status as keyof typeof order] ?? 1;
        if (ao !== bo) return ao - bo;
        return (a.name || '').localeCompare(b.name || '');
      });
      setCategories(cats);
    });
    return () => unsubscribe();
  }, [id]);

  // Fetch mats for the competition
  useEffect(() => {
    const q = query(collection(db, 'competitions', id, 'mats'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matList = snapshot.docs.map(d => d.data().name || d.id);
      setMats(matList);
    });
    return () => unsubscribe();
  }, [id]);

  const openModal = (catId?: string) => {
    setActiveCategoryId(catId || categories[0]?.id || null);
    setModalOpen(true);
  };

  const liveCategories = categories.filter(c => c.status === 'live');
  const upcomingCategories = categories.filter(c => c.status !== 'live' && c.status !== 'completed');
  const completedCategories = categories.filter(c => c.status === 'completed');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .tiesheet-page {
          padding: var(--space-6);
          max-width: 1200px;
          margin: 0 auto;
        }
        .tiesheet-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-6);
        }
        .tiesheet-section-title {
          font-family: var(--font-display);
          font-size: 13px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--neutral-500);
          margin-bottom: var(--space-3);
          padding-left: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tiesheet-section-title::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--neutral-200);
        }
        .tiesheet-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: var(--space-3);
          margin-bottom: var(--space-6);
        }
        .tiesheet-card {
          background: var(--shiro);
          border: 1px solid var(--neutral-200);
          border-radius: 16px;
          padding: var(--space-4);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tiesheet-card:hover {
          border-color: var(--neutral-400);
          transform: translateY(-4px);
          box-shadow: 0 12px 32px -8px rgba(0,0,0,0.1);
        }
        .tiesheet-card.live-card {
          border-color: var(--status-live);
          box-shadow: 0 0 0 2px var(--status-live-bg), 0 8px 24px -8px rgba(217,38,44,0.15);
        }
        .tiesheet-card.completed-card {
          opacity: 0.7;
        }
        .tiesheet-card-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--neutral-900);
          line-height: 1.3;
        }
        .tiesheet-card-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          font-weight: 600;
          color: var(--neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .live-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--status-live);
          font-weight: 800;
          font-size: 11px;
        }
        .live-dot-sm {
          width: 6px;
          height: 6px;
          background: var(--status-live);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--status-live);
          animation: pulse 2s infinite;
        }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
        .tiesheet-card-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--neutral-100);
        }
        .btn-view-tiesheet {
          flex: 1;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: transparent;
          border: 1px solid var(--neutral-300);
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          color: var(--neutral-700);
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-view-tiesheet:hover {
          background: var(--neutral-100);
          border-color: var(--neutral-500);
          color: var(--neutral-900);
        }
        .tiesheet-card.live-card .btn-view-tiesheet {
          background: var(--aka);
          border-color: var(--aka);
          color: white;
        }
        .tiesheet-card.live-card .btn-view-tiesheet:hover {
          background: var(--aka-hover);
        }
        .empty-state {
          padding: var(--space-12);
          text-align: center;
          color: var(--neutral-400);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
      `}} />

      <div className="tiesheet-page">
        {/* Page Hero */}
        <div className="tiesheet-hero">
          <div>
            <h2 style={{ fontSize: '24px', margin: '0 0 4px 0' }}>Tiesheet Management</h2>
            <p style={{ fontSize: '14px', color: 'var(--neutral-500)', margin: 0 }}>
              {categories.length} categories • Click any category to open its bracket
            </p>
          </div>
          {categories.length > 0 && (
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => openModal()}>
              <Eye size={16} />
              Open All Brackets
            </button>
          )}
        </div>

        {categories.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px' }}>⚔️</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>No tiesheets generated yet</div>
            <p style={{ fontSize: '14px', maxWidth: '320px' }}>
              Go to the Setup Wizard and complete Phase 2 (Import Athletes) to generate tiesheets for this competition.
            </p>
          </div>
        ) : (
          <>
            {/* Live Categories */}
            {liveCategories.length > 0 && (
              <>
                <div className="tiesheet-section-title">
                  <span>🔴</span> Live Now
                </div>
                <div className="tiesheet-grid">
                  {liveCategories.map(cat => (
                    <TiesheetCard key={cat.id} cat={cat} onClick={() => openModal(cat.id)} />
                  ))}
                </div>
              </>
            )}

            {/* Upcoming Categories */}
            {upcomingCategories.length > 0 && (
              <>
                <div className="tiesheet-section-title">
                  <span>🕐</span> Upcoming
                </div>
                <div className="tiesheet-grid">
                  {upcomingCategories.map(cat => (
                    <TiesheetCard key={cat.id} cat={cat} onClick={() => openModal(cat.id)} />
                  ))}
                </div>
              </>
            )}

            {/* Completed Categories */}
            {completedCategories.length > 0 && (
              <>
                <div className="tiesheet-section-title">
                  <span>✅</span> Completed
                </div>
                <div className="tiesheet-grid">
                  {completedCategories.map(cat => (
                    <TiesheetCard key={cat.id} cat={cat} onClick={() => openModal(cat.id)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Fullscreen Modal */}
      {modalOpen && (
        <FullscreenBracketModal
          categories={categories}
          initialCategoryId={activeCategoryId || undefined}
          mats={mats}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

// ---- TiesheetCard sub-component ----
function TiesheetCard({ cat, onClick }: { cat: any; onClick: () => void }) {
  const isLive = cat.status === 'live';
  const isCompleted = cat.status === 'completed';
  const matchCount = (cat.matches || []).filter((m: any) => m.round === 1 && (m.aka || m.ao)).length;
  const athleteCount = cat.athletes?.length || matchCount * 2;

  return (
    <div
      className={`tiesheet-card${isLive ? ' live-card' : ''}${isCompleted ? ' completed-card' : ''}`}
      onClick={onClick}
    >
      <div className="tiesheet-card-name">{cat.name}</div>
      <div className="tiesheet-card-meta">
        {isLive ? (
          <div className="live-badge">
            <div className="live-dot-sm" />
            {cat.mat ? `MAT ${cat.mat.padStart(2, '0')} • LIVE` : 'LIVE'}
          </div>
        ) : (
          <div style={{ color: isCompleted ? 'var(--neutral-400)' : 'var(--status-upcoming)' }}>
            {isCompleted ? 'COMPLETED' : (cat.mat ? `MAT ${cat.mat.padStart(2, '0')} • UPCOMING` : 'NOT ASSIGNED')}
          </div>
        )}
        <div>{athleteCount} ATHLETES</div>
      </div>
      <div className="tiesheet-card-footer">
        <button className="btn-view-tiesheet">
          <Eye size={12} />
          View Tiesheet
        </button>
      </div>
    </div>
  );
}
