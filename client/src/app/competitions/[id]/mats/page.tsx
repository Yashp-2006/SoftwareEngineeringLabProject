'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { LayoutGrid, Plus, Timer, Activity, Coffee, CalendarPlus } from 'lucide-react';
import gsap from 'gsap';

export default function MatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  useEffect(() => {
    gsap.from('.bento-reveal', {
      y: 30,
      opacity: 0,
      duration: 0.6,
      stagger: 0.08,
      ease: 'power3.out'
    });
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .mat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: var(--space-5);
          margin-top: var(--space-5);
        }
        .mat-card {
          background: var(--shiro);
          border: 1px solid var(--neutral-200);
          border-radius: 12px;
          padding: var(--space-5);
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          display: flex;
          flex-direction: column;
          position: relative;
          text-decoration: none;
          color: inherit;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .mat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.08);
          border-color: var(--neutral-300);
        }
        .mat-card.live {
          border-top: 4px solid var(--status-live);
        }
        .mat-card.standby {
          border-top: 4px solid var(--neutral-300);
        }
        .mat-number {
          font-family: var(--font-display);
          font-size: 32px;
          line-height: 1;
          color: var(--neutral-900);
          letter-spacing: 0.02em;
        }
        .mat-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-4);
        }
        .category-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--space-1);
        }
        .category-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--neutral-900);
          margin-bottom: var(--space-4);
          min-height: 48px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.4;
        }
        .score-board {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: var(--space-2);
          align-items: center;
          background: var(--neutral-50);
          border-radius: 8px;
          border: 1px solid var(--neutral-200);
          padding: var(--space-3);
          margin-bottom: var(--space-4);
        }
        .score-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-2) 0;
          border-radius: 6px;
        }
        .score-side.aka { background: var(--aka-light); box-shadow: inset 0 0 0 1px rgba(217, 38, 44, 0.1); }
        .score-side.ao { background: var(--ao-light); box-shadow: inset 0 0 0 1px rgba(26, 77, 181, 0.1); }
        
        .score-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin-bottom: var(--space-1);
        }
        .score-label.aka { color: var(--aka); }
        .score-label.ao { color: var(--ao); }
        
        .score-value {
          font-family: var(--font-mono);
          font-size: 32px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.05em;
        }
        .score-value.aka { color: var(--aka); }
        .score-value.ao { color: var(--ao); }
        
        .score-pen {
          font-size: 10px;
          font-weight: 700;
          color: var(--neutral-500);
          margin-top: var(--space-1);
          background: var(--shiro);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid var(--neutral-200);
        }
        
        .score-divider {
          font-size: 11px;
          font-weight: 800;
          color: var(--neutral-400);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .mat-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: var(--space-4);
          border-top: 1px solid var(--neutral-100);
        }
        .time-remaining {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 600;
          color: var(--neutral-700);
        }
        .time-remaining i {
          width: 14px;
          height: 14px;
          color: var(--status-live);
        }
        .btn-action {
          background: var(--neutral-100);
          color: var(--neutral-700);
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .btn-action:hover {
          background: var(--neutral-200);
          color: var(--neutral-900);
        }
        .btn-action.primary {
          background: var(--kuro);
          color: var(--shiro);
        }
        .btn-action.primary:hover {
          background: var(--neutral-700);
        }
        
        /* Standby State */
        .standby-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 154px;
          background: var(--neutral-50);
          border: 1px dashed var(--neutral-300);
          border-radius: 8px;
          margin-bottom: var(--space-4);
          transition: all 0.2s;
        }
        .mat-card:hover .standby-state {
          border-color: var(--neutral-400);
          background: var(--neutral-100);
        }
        .standby-state i {
          color: var(--neutral-400);
          margin-bottom: var(--space-2);
          width: 28px;
          height: 28px;
        }
        .standby-state span {
          font-size: 14px;
          font-weight: 600;
          color: var(--neutral-500);
        }
        
        .status-chip {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .status-chip.status-live { background: var(--status-live-bg); color: var(--status-live); }
        .status-chip.status-live::before {
          content: '';
          display: block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--status-live);
          box-shadow: 0 0 0 2px var(--status-live-bg);
          animation: pulse 2s infinite;
        }
        .status-chip.status-done { background: var(--neutral-100); color: var(--neutral-500); }
        
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(98, 224, 145, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(98, 224, 145, 0); }
          100% { box-shadow: 0 0 0 0 rgba(98, 224, 145, 0); }
        }
        
        .filters {
          display: flex;
          gap: var(--space-2);
        }
        .filter-btn {
          background: transparent;
          border: 1px solid var(--neutral-200);
          color: var(--neutral-600);
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .filter-btn:hover {
          background: var(--neutral-50);
          color: var(--neutral-900);
        }
        .filter-btn.active {
          background: var(--kuro);
          color: var(--shiro);
          border-color: var(--kuro);
        }
        
        .page-header-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: var(--space-4);
        }
        .controls-row {
          display: flex;
          gap: var(--space-3);
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Operations
            </div>
            <h1>Mat Management</h1>
          </div>
          <div className="page-header-actions">
            <div className="controls-row">
              <button className="btn btn-secondary">
                <LayoutGrid style={{ width: '16px', marginRight: '6px' }} /> Grid View
              </button>
              <button className="btn btn-primary">
                <Plus style={{ width: '16px', marginRight: '6px' }} /> Add Mat
              </button>
            </div>
            <div className="filters">
              <button className="filter-btn active">All Mats (6)</button>
              <button className="filter-btn">Live (3)</button>
              <button className="filter-btn">Standby (3)</button>
            </div>
          </div>
        </header>

        <div className="mat-grid">
          {/* Mat 01 */}
          <Link href={`/competitions/${id}/operator`} className="mat-card live bento-reveal">
            <div className="mat-header">
              <span className="mat-number">MAT 01</span>
              <span className="status-chip status-live">Live</span>
            </div>
            <div className="category-label">Current Category</div>
            <div className="category-title">Senior Male Kumite -75kg<br /><span style={{ color: 'var(--neutral-500)', fontWeight: 500, fontSize: '14px' }}>Semi-Final</span></div>
            
            <div className="score-board">
              <div className="score-side aka">
                <div className="score-label aka">AKA</div>
                <div className="score-value aka">3</div>
                <div className="score-pen">PEN 2</div>
              </div>
              <div className="score-divider">PTS</div>
              <div className="score-side ao">
                <div className="score-label ao">AO</div>
                <div className="score-value ao">1</div>
                <div className="score-pen">PEN 1</div>
              </div>
            </div>
            
            <div className="mat-footer">
              <div className="time-remaining">
                <Timer size={14} style={{ color: 'var(--status-live)' }} /> 01:42
              </div>
              <button className="btn-action">Manage</button>
            </div>
          </Link>

          {/* Mat 02 */}
          <Link href={`/competitions/${id}/operator`} className="mat-card live bento-reveal">
            <div className="mat-header">
              <span className="mat-number">MAT 02</span>
              <span className="status-chip status-live">Live</span>
            </div>
            <div className="category-label">Current Category</div>
            <div className="category-title">Senior Female Kata<br /><span style={{ color: 'var(--neutral-500)', fontWeight: 500, fontSize: '14px' }}>Final</span></div>
            
            <div className="score-board">
              <div className="score-side aka">
                <div className="score-label aka">AKA</div>
                <div className="score-value aka">24.6</div>
                <div className="score-pen">PEN 0</div>
              </div>
              <div className="score-divider">SCORE</div>
              <div className="score-side ao">
                <div className="score-label ao">AO</div>
                <div className="score-value ao">24.2</div>
                <div className="score-pen">PEN 0</div>
              </div>
            </div>
            
            <div className="mat-footer">
              <div className="time-remaining" style={{ color: 'var(--neutral-500)' }}>
                <Activity size={14} style={{ color: 'var(--neutral-400)' }} /> Kata in Progress
              </div>
              <button className="btn-action">Manage</button>
            </div>
          </Link>

          {/* Mat 03 */}
          <Link href={`/competitions/${id}/operator`} className="mat-card live bento-reveal">
            <div className="mat-header">
              <span className="mat-number">MAT 03</span>
              <span className="status-chip status-live">Live</span>
            </div>
            <div className="category-label">Current Category</div>
            <div className="category-title">U21 Male Kumite +84kg<br /><span style={{ color: 'var(--neutral-500)', fontWeight: 500, fontSize: '14px' }}>Elimination</span></div>
            
            <div className="score-board">
              <div className="score-side aka">
                <div className="score-label aka">AKA</div>
                <div className="score-value aka">0</div>
                <div className="score-pen">PEN 0</div>
              </div>
              <div className="score-divider">PTS</div>
              <div className="score-side ao">
                <div className="score-label ao">AO</div>
                <div className="score-value ao">0</div>
                <div className="score-pen">PEN 0</div>
              </div>
            </div>
            
            <div className="mat-footer">
              <div className="time-remaining">
                <Timer size={14} style={{ color: 'var(--status-live)' }} /> 03:00
              </div>
              <button className="btn-action">Manage</button>
            </div>
          </Link>

          {/* Mat 04 */}
          <div className="mat-card standby bento-reveal">
            <div className="mat-header">
              <span className="mat-number">MAT 04</span>
              <span className="status-chip status-done">Standby</span>
            </div>
            
            <div className="standby-state">
              <Coffee size={28} style={{ color: 'var(--neutral-400)', marginBottom: 'var(--space-2)' }} />
              <span>No Active Event</span>
            </div>
            
            <div className="mat-footer" style={{ justifyContent: 'center' }}>
              <button className="btn-action primary" style={{ width: '100%', justifyContent: 'center' }}>
                <CalendarPlus size={16} style={{ marginRight: '6px' }} /> Assign Event
              </button>
            </div>
          </div>

          {/* Mat 05 */}
          <div className="mat-card standby bento-reveal">
            <div className="mat-header">
              <span className="mat-number">MAT 05</span>
              <span className="status-chip status-done">Standby</span>
            </div>
            
            <div className="standby-state">
              <Coffee size={28} style={{ color: 'var(--neutral-400)', marginBottom: 'var(--space-2)' }} />
              <span>No Active Event</span>
            </div>
            
            <div className="mat-footer" style={{ justifyContent: 'center' }}>
              <button className="btn-action primary" style={{ width: '100%', justifyContent: 'center' }}>
                <CalendarPlus size={16} style={{ marginRight: '6px' }} /> Assign Event
              </button>
            </div>
          </div>

          {/* Mat 06 */}
          <div className="mat-card standby bento-reveal">
            <div className="mat-header">
              <span className="mat-number">MAT 06</span>
              <span className="status-chip status-done">Standby</span>
            </div>
            
            <div className="standby-state">
              <Coffee size={28} style={{ color: 'var(--neutral-400)', marginBottom: 'var(--space-2)' }} />
              <span>No Active Event</span>
            </div>
            
            <div className="mat-footer" style={{ justifyContent: 'center' }}>
              <button className="btn-action primary" style={{ width: '100%', justifyContent: 'center' }}>
                <CalendarPlus size={16} style={{ marginRight: '6px' }} /> Assign Event
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
