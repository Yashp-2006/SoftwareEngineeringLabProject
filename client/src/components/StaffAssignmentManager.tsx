'use client';

import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import gsap from 'gsap';

export interface StaffAssignment {
  id: string;
  scope: string; // e.g. "MAT 01", "Senior Male Kumite -75kg", "National / State"
  scopeSubtitle?: string;
  role: string;
  coverage?: string; // used for Medal Distributors
  operator: string; // name
  operatorSubtitle?: string;
  statusText: string;
  statusCode: 'live' | 'upcoming' | 'idle';
  type: 'score' | 'attendance' | 'medal' | 'viewer';
}

const INITIAL_DATA: StaffAssignment[] = [
  // Mat Operators
  { id: 's1', type: 'score', scope: 'MAT 01', operator: 'Lucas Rossi', operatorSubtitle: 'Mat Operator', statusText: 'On Shift', statusCode: 'live', role: 'Mat Operator', coverage: 'Senior Male Kumite -75kg', scopeSubtitle: 'Semi-Final' },
  { id: 's2', type: 'score', scope: 'MAT 02', operator: 'Amina Ndiaye', operatorSubtitle: 'Mat Operator', statusText: 'On Shift', statusCode: 'live', role: 'Mat Operator', coverage: 'Senior Female Kata', scopeSubtitle: 'Round of 16' },
  { id: 's3', type: 'score', scope: 'MAT 03', operator: 'Unassigned', statusText: 'Standby', statusCode: 'upcoming', role: 'Mat Operator', coverage: 'U21 Male Kumite +84kg', scopeSubtitle: 'Warm-up' },
  { id: 's4', type: 'score', scope: 'MAT 04', operator: 'Kenji Sato', operatorSubtitle: 'Mat Operator', statusText: 'On Shift', statusCode: 'live', role: 'Mat Operator', coverage: 'Junior Female Kumite +59kg', scopeSubtitle: 'Quarter-Final' },
  { id: 's5', type: 'score', scope: 'MAT 05', operator: 'Yumi Tanaka', operatorSubtitle: 'Mat Operator', statusText: 'Standby', statusCode: 'upcoming', role: 'Mat Operator', coverage: 'Senior Team Kata', scopeSubtitle: 'Next Match 11:40' },
  
  // Attendance
  { id: 'a1', type: 'attendance', scope: 'Senior Male Kumite -75kg', operator: 'Maria Garcia', statusText: 'Ready', statusCode: 'live', role: 'Attendance Volunteer', coverage: '30 / 32', scopeSubtitle: '2 pending' },
  { id: 'a2', type: 'attendance', scope: 'Senior Female Kata', operator: 'Rafael Silva', statusText: 'Ready', statusCode: 'live', role: 'Attendance Volunteer', coverage: '24 / 24', scopeSubtitle: 'All present' },
  { id: 'a3', type: 'attendance', scope: 'U21 Male Kumite +84kg', operator: 'Aiko Mori', statusText: 'Pending', statusCode: 'upcoming', role: 'Attendance Volunteer', coverage: '12 / 16', scopeSubtitle: '4 pending' },
  { id: 'a4', type: 'attendance', scope: 'Junior Female Kumite +59kg', operator: 'Elena Costa', statusText: 'Pending', statusCode: 'upcoming', role: 'Attendance Volunteer', coverage: '18 / 20', scopeSubtitle: '2 pending' },
  { id: 'a5', type: 'attendance', scope: 'Senior Team Kata', operator: 'Unassigned', statusText: 'Not Ready', statusCode: 'idle', role: 'Attendance Volunteer', coverage: '0 / 8', scopeSubtitle: 'Awaiting arrival' },

  // Medal
  { id: 'm1', type: 'medal', scope: 'National / State', scopeSubtitle: 'Kansai Region', operator: 'Yuki Tanaka', operatorSubtitle: 'Lead Distributor', statusText: 'Active', statusCode: 'live', role: 'Medal Distributor', coverage: 'All Senior Categories' },
  { id: 'm2', type: 'medal', scope: 'International / Country', scopeSubtitle: 'Global Delegations', operator: 'Rafael Silva', statusText: 'Standby', statusCode: 'upcoming', role: 'Medal Distributor', coverage: 'Team Kata + Open Divisions' },
  { id: 'm3', type: 'medal', scope: 'Local / Academy', operator: 'Unassigned', statusText: 'Needs Assignment', statusCode: 'idle', role: 'Medal Distributor', coverage: 'Junior Categories' },

  // Guest Viewer
  { id: 'v1', type: 'viewer', scope: 'Global Access', operator: 'Unassigned', statusText: 'Needs Assignment', statusCode: 'idle', role: 'Guest Viewer', coverage: 'Read-only access to internals' },
];

export default function StaffAssignmentManager({ competitionId }: { competitionId: string }) {
  const [staffData, setStaffData] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    let unsub: () => void;
    const setup = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, query } = await import('firebase/firestore');

      const staffQ = query(collection(db, 'competitions', competitionId, 'staff'));
      unsub = onSnapshot(staffQ, (snap) => {
        const staff = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as StaffAssignment[];
        setStaffData(staff);
        setLoading(false);
      });
    };

    setup();
    return () => { if (unsub) unsub(); };
  }, [competitionId]);

  useEffect(() => {
    if (!loading && staffData.length > 0) {
      gsap.from('.staff-card', {
        y: 16,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power2.out'
      });
    }
  }, [loading, staffData.length]);

  const scoreStaff = staffData.filter(s => s.type === 'score');
  const attendanceStaff = staffData.filter(s => s.type === 'attendance');
  const medalStaff = staffData.filter(s => s.type === 'medal');
  const viewerStaff = staffData.filter(s => s.type === 'viewer');

  const openModal = (assignId: string) => {
    setSelectedAssignmentId(assignId);
    setSelectedPerson('');
    setAssignModalOpen(true);
  };

  const closeModal = () => {
    setAssignModalOpen(false);
    setSelectedAssignmentId(null);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentId) return;

    const newName = selectedPerson || 'Unassigned';
    const assignment = staffData.find(s => s.id === selectedAssignmentId);
    if (!assignment) return;

    const updates = {
      operator: newName,
      statusCode: newName === 'Unassigned' ? 'idle' : 'live',
      statusText: newName === 'Unassigned' ? 'Needs Assignment' : 'Assigned',
      operatorSubtitle: newName !== 'Unassigned' ? assignment.role : null
    };

    // Optimistic
    setStaffData(prev => prev.map(s => s.id === selectedAssignmentId ? { ...s, ...updates } as StaffAssignment : s));
    closeModal();

    // Persist
    try {
      const { db } = await import('@lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      const staffRef = doc(db, 'competitions', competitionId, 'staff', selectedAssignmentId);
      await updateDoc(staffRef, updates);
    } catch (err) {
      console.error('Failed to update assignment', err);
    }
  };

  const handleSeedStaff = async () => {
    setIsSeeding(true);
    try {
      const { db } = await import('@lib/firebase');
      const { writeBatch, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      INITIAL_DATA.forEach(staff => {
        const staffRef = doc(db, 'competitions', competitionId, 'staff', staff.id);
        batch.set(staffRef, staff);
      });
      
      await batch.commit();
    } catch (err) {
      console.error('Failed to seed staff', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const activeAssignment = staffData.find(s => s.id === selectedAssignmentId);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .staff-stack {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }
        .staff-card {
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 12px;
          padding: var(--space-5);
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .staff-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-4);
          gap: var(--space-4);
          flex-wrap: wrap;
        }
        .staff-table {
          width: 100%;
          border-collapse: collapse;
        }
        .staff-table th {
          text-align: left;
          padding: 10px 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--neutral-500);
          border-bottom: 1px solid var(--neutral-200);
        }
        .staff-table td {
          padding: 12px;
          border-bottom: 1px solid var(--neutral-100);
          font-size: 14px;
          vertical-align: top;
        }
        .staff-table tr:last-child td {
          border-bottom: none;
        }
        .staff-meta {
          font-size: 12px;
          color: var(--neutral-500);
        }
        .status-idle {
          background: var(--neutral-200);
          color: var(--neutral-600);
        }
        .scope-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: var(--neutral-100);
          color: var(--neutral-600);
        }
        .staff-actions {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }
        .assign-modal {
          position: fixed;
          inset: 0;
          display: none;
          align-items: center;
          justify-content: center;
          padding: var(--space-5);
          background: rgba(15, 23, 42, 0.45);
          z-index: 1000;
        }
        .assign-modal.active {
          display: flex;
        }
        .assign-card {
          width: min(640px, 94vw);
          background: var(--shiro);
          border-radius: 16px;
          border: 1px solid var(--neutral-300);
          padding: var(--space-6);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
        }
        .assign-header {
          display: flex;
          justify-content: space-between;
          gap: var(--space-4);
          align-items: flex-start;
          margin-bottom: var(--space-4);
        }
        .icon-only {
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .assign-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--space-4);
        }
        .assign-field label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--neutral-500);
          margin-bottom: 8px;
        }
        .assign-field input,
        .assign-field select,
        .assign-field textarea {
          width: 100%;
          height: 42px;
          border-radius: 10px;
          border: 1.5px solid var(--neutral-300);
          padding: 0 12px;
          font-family: var(--font-body);
          font-size: 14px;
          outline: none;
          background: var(--shiro);
        }
        .assign-field textarea {
          min-height: 72px;
          padding: 10px 12px;
          resize: vertical;
        }
        .assign-field input:disabled {
          background: var(--neutral-100);
          color: var(--neutral-600);
        }
        .assign-field.full {
          grid-column: 1 / -1;
        }
        .assign-footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
          margin-top: var(--space-5);
        }
        .empty-state {
          padding: var(--space-10);
          text-align: center;
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        @media (max-width: 900px) {
          .staff-table thead {
            display: none;
          }
          .staff-table tr {
            display: block;
            border-bottom: 1px solid var(--neutral-200);
            padding-bottom: var(--space-3);
            margin-bottom: var(--space-3);
          }
          .staff-table td {
            display: flex;
            justify-content: space-between;
            gap: var(--space-3);
            border-bottom: none;
            padding: 6px 0;
          }
          .staff-table td::before {
            content: attr(data-label);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--neutral-500);
          }
        }
        @media (max-width: 640px) {
          .assign-grid {
            grid-template-columns: 1fr;
          }
        }
      `}} />

      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--neutral-500)' }}>
          Loading staff roster...
        </div>
      ) : staffData.length === 0 ? (
        <div className="empty-state">
          <h3 style={{ marginBottom: '8px' }}>No Staff Assignments Found</h3>
          <p style={{ color: 'var(--neutral-500)', marginBottom: '24px' }}>There are no staff roles seeded for this competition yet.</p>
          <button className="btn btn-primary" onClick={handleSeedStaff} disabled={isSeeding}>
            <Plus size={16} style={{ marginRight: '6px' }} />
            {isSeeding ? 'Seeding...' : 'Seed Initial Staff Data'}
          </button>
        </div>
      ) : (
        <div className="staff-stack">
          {/* Mat Operators */}
          {scoreStaff.length > 0 && (
            <section className="staff-card">
              <div className="staff-header">
                <div>
                  <h3>Mat Operators</h3>
                  <p className="text-small">Who is running each mat right now and which category they are handling.</p>
                </div>
              </div>
              <div className="table-responsive">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Mat</th>
                    <th>Operator</th>
                    <th>Current Category</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreStaff.map(s => (
                    <tr key={s.id}>
                      <td data-label="Mat"><strong>{s.scope}</strong></td>
                      <td data-label="Operator" className="staff-name">
                        {s.operator}
                        {s.operatorSubtitle && <><br /><span className="staff-meta">{s.operatorSubtitle}</span></>}
                      </td>
                      <td data-label="Current Category">
                        {s.coverage}
                        {s.scopeSubtitle && <><br /><span className="staff-meta">{s.scopeSubtitle}</span></>}
                      </td>
                      <td data-label="Status" className="staff-status">
                        <span className={`status-chip status-${s.statusCode}`}>{s.statusText}</span>
                      </td>
                      <td data-label="Actions">
                        <div className="staff-actions">
                          <button className="btn btn-ghost" onClick={() => openModal(s.id)}>
                            {s.operator === 'Unassigned' ? 'Assign' : 'Reassign'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          )}

          {/* Attendance Volunteers */}
          {attendanceStaff.length > 0 && (
            <section className="staff-card">
              <div className="staff-header">
                <div>
                  <h3>Attendance Volunteers by Category</h3>
                  <p className="text-small">Volunteer coverage for athlete check-in and readiness by division.</p>
                </div>
              </div>
              <div className="table-responsive">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Volunteer</th>
                    <th>Check-in</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceStaff.map(s => (
                    <tr key={s.id}>
                      <td data-label="Category">{s.scope}</td>
                      <td data-label="Volunteer" className="staff-name">
                        {s.operator}
                        {s.operatorSubtitle && <><br /><span className="staff-meta">{s.operatorSubtitle}</span></>}
                      </td>
                      <td data-label="Check-in">
                        <strong>{s.coverage}</strong>
                        {s.scopeSubtitle && <><br /><span className="staff-meta">{s.scopeSubtitle}</span></>}
                      </td>
                      <td data-label="Status" className="staff-status">
                        <span className={`status-chip status-${s.statusCode}`}>{s.statusText}</span>
                      </td>
                      <td data-label="Actions">
                        <div className="staff-actions">
                          <button className="btn btn-ghost" onClick={() => openModal(s.id)}>
                            {s.operator === 'Unassigned' ? 'Assign' : 'Reassign'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          )}

          {/* Medal Distributors */}
          {medalStaff.length > 0 && (
            <section className="staff-card">
              <div className="staff-header">
                <div>
                  <h3>Medal Distributors</h3>
                  <p className="text-small">Who is assigned to distribute medals and the scope they cover.</p>
                </div>
              </div>
              <div className="table-responsive">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Distributor</th>
                    <th>Scope</th>
                    <th>Coverage</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {medalStaff.map(s => (
                    <tr key={s.id}>
                      <td data-label="Distributor" className="staff-name">
                        {s.operator}
                        {s.operatorSubtitle && <><br /><span className="staff-meta">{s.operatorSubtitle}</span></>}
                      </td>
                      <td data-label="Scope">
                        <span className="scope-pill">{s.scope}</span>
                        {s.scopeSubtitle && <><br /><span className="staff-meta">{s.scopeSubtitle}</span></>}
                      </td>
                      <td data-label="Coverage">{s.coverage}</td>
                      <td data-label="Status" className="staff-status">
                        <span className={`status-chip status-${s.statusCode}`}>{s.statusText}</span>
                      </td>
                      <td data-label="Actions">
                        <div className="staff-actions">
                          <button className="btn btn-ghost" onClick={() => openModal(s.id)}>
                            {s.operator === 'Unassigned' ? 'Assign' : 'Reassign'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          )}

          {/* Guest Viewers */}
          {viewerStaff.length > 0 && (
            <section className="staff-card">
              <div className="staff-header">
                <div>
                  <h3>Guest Viewers</h3>
                  <p className="text-small">Assign read-only access to view the internal workings of the app without write permissions.</p>
                </div>
              </div>
              <div className="table-responsive">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Viewer</th>
                    <th>Scope</th>
                    <th>Coverage</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {viewerStaff.map(s => (
                    <tr key={s.id}>
                      <td data-label="Viewer" className="staff-name">
                        {s.operator}
                        {s.operatorSubtitle && <><br /><span className="staff-meta">{s.operatorSubtitle}</span></>}
                      </td>
                      <td data-label="Scope">
                        <span className="scope-pill">{s.scope}</span>
                        {s.scopeSubtitle && <><br /><span className="staff-meta">{s.scopeSubtitle}</span></>}
                      </td>
                      <td data-label="Coverage">{s.coverage}</td>
                      <td data-label="Status" className="staff-status">
                        <span className={`status-chip status-${s.statusCode}`}>{s.statusText}</span>
                      </td>
                      <td data-label="Actions">
                        <div className="staff-actions">
                          <button className="btn btn-ghost" onClick={() => openModal(s.id)}>
                            {s.operator === 'Unassigned' ? 'Assign' : 'Reassign'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Assign Modal */}
      <div className={`assign-modal ${assignModalOpen ? 'active' : ''}`} aria-hidden={!assignModalOpen} onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}>
        <div className="assign-card">
          <div className="assign-header">
            <div>
              <div className="text-micro">Live roster update</div>
              <h3>Reassign {activeAssignment?.role}</h3>
              <p className="text-small">Currently: {activeAssignment?.operator}</p>
            </div>
            <button className="btn btn-ghost icon-only" type="button" onClick={closeModal}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleAssignSubmit}>
            <div className="assign-grid">
              <div className="assign-field full">
                <label>Assignment scope</label>
                <input type="text" value={activeAssignment?.scope || ''} disabled />
              </div>
              <div className="assign-field">
                <label>Role</label>
                <input type="text" value={activeAssignment?.role || ''} disabled />
              </div>
              <div className="assign-field">
                <label>Assign to</label>
                <select required value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)}>
                  <option value="">Select staff member</option>
                  <option>Lucas Rossi</option>
                  <option>Amina Ndiaye</option>
                  <option>Kenji Sato</option>
                  <option>Yumi Tanaka</option>
                  <option>Maria Garcia</option>
                  <option>Rafael Silva</option>
                  <option>Aiko Mori</option>
                  <option>Elena Costa</option>
                  <option>Yuki Tanaka</option>
                  <option>Kenji Nakamura</option>
                  <option value="Unassigned">Unassigned</option>
                </select>
              </div>
            </div>
            <div className="assign-footer">
              <button className="btn btn-secondary" type="button" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" type="submit">Update Assignment</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
