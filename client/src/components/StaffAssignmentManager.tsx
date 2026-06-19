'use client';

import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import gsap from 'gsap';
import { useAuth } from '@/components/auth/AuthProvider';

export interface StaffAssignment {
  id: string;
  scope: string; // e.g. "MAT 01", "Senior Male Kumite -75kg", "National / State"
  scopeSubtitle?: string;
  role: string;
  coverage?: string; // used for Medal Distributors
  operator: string; // name
  operatorSubtitle?: string;
  type: 'score' | 'attendance' | 'medal' | 'judge';
}

const INITIAL_DATA: StaffAssignment[] = [
  // Mat Operators
  { id: 's1', type: 'score', scope: 'MAT 01', operator: 'Lucas Rossi', operatorSubtitle: 'Mat Operator', role: 'Mat Operator', coverage: 'Senior Male Kumite -75kg', scopeSubtitle: 'Semi-Final' },
  { id: 's2', type: 'score', scope: 'MAT 02', operator: 'Amina Ndiaye', operatorSubtitle: 'Mat Operator', role: 'Mat Operator', coverage: 'Senior Female Kata', scopeSubtitle: 'Round of 16' },
  { id: 's3', type: 'score', scope: 'MAT 03', operator: 'Unassigned', role: 'Mat Operator', coverage: 'U21 Male Kumite +84kg', scopeSubtitle: 'Warm-up' },
  { id: 's4', type: 'score', scope: 'MAT 04', operator: 'Kenji Sato', operatorSubtitle: 'Mat Operator', role: 'Mat Operator', coverage: 'Junior Female Kumite +59kg', scopeSubtitle: 'Quarter-Final' },
  { id: 's5', type: 'score', scope: 'MAT 05', operator: 'Yumi Tanaka', operatorSubtitle: 'Mat Operator', role: 'Mat Operator', coverage: 'Senior Team Kata', scopeSubtitle: 'Next Match 11:40' },
  
  // Attendance
  { id: 'a1', type: 'attendance', scope: 'Senior Male Kumite -75kg', operator: 'Maria Garcia', role: 'Attendance Volunteer', coverage: '30 / 32', scopeSubtitle: '2 pending' },
  { id: 'a2', type: 'attendance', scope: 'Senior Female Kata', operator: 'Rafael Silva', role: 'Attendance Volunteer', coverage: '24 / 24', scopeSubtitle: 'All present' },
  { id: 'a3', type: 'attendance', scope: 'U21 Male Kumite +84kg', operator: 'Aiko Mori', role: 'Attendance Volunteer', coverage: '12 / 16', scopeSubtitle: '4 pending' },
  { id: 'a4', type: 'attendance', scope: 'Junior Female Kumite +59kg', operator: 'Elena Costa', role: 'Attendance Volunteer', coverage: '18 / 20', scopeSubtitle: '2 pending' },
  { id: 'a5', type: 'attendance', scope: 'Senior Team Kata', operator: 'Unassigned', role: 'Attendance Volunteer', coverage: '0 / 8', scopeSubtitle: 'Awaiting arrival' },

  // Medal
  { id: 'm1', type: 'medal', scope: 'Medal Distributor 1', operator: 'Yuki Tanaka', operatorSubtitle: 'Lead Distributor', role: 'Medal Distributor', coverage: 'All Senior Categories' },
  { id: 'm2', type: 'medal', scope: 'Medal Distributor 2', operator: 'Rafael Silva', role: 'Medal Distributor', coverage: 'Team Kata + Open Divisions' },
  { id: 'm3', type: 'medal', scope: 'Medal Distributor 3', operator: 'Unassigned', role: 'Medal Distributor', coverage: 'Junior Categories' },

  // Judges
  { id: 'j1', type: 'judge', scope: 'MAT 01', scopeSubtitle: 'Judge 1', operator: 'Kenji Nakamura', role: 'Judge', coverage: 'All Matches on Mat 1' },
  { id: 'j2', type: 'judge', scope: 'MAT 01', scopeSubtitle: 'Judge 2', operator: 'Unassigned', role: 'Judge', coverage: 'All Matches on Mat 1' },
  { id: 'j3', type: 'judge', scope: 'MAT 02', scopeSubtitle: 'Judge 1', operator: 'Unassigned', role: 'Judge', coverage: 'All Matches on Mat 2' },
];

export default function StaffAssignmentManager({ competitionId, isSetupMode = false }: { competitionId: string, isSetupMode?: boolean }) {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [staffData, setStaffData] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState('');
  const [coverageInput, setCoverageInput] = useState('');
  const [scopeSubtitleInput, setScopeSubtitleInput] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
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

      const { getDocs } = await import('firebase/firestore');
      const catSnap = await getDocs(collection(db, 'competitions', competitionId, 'categories'));
      setCategories(catSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.id })));
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
  const judgeStaff = staffData.filter(s => s.type === 'judge');

  const openModal = (assignId: string) => {
    setSelectedAssignmentId(assignId);
    const assignment = staffData.find(s => s.id === assignId);
    setSelectedPerson(assignment?.operator !== 'Unassigned' ? assignment?.operator || '' : '');
    setCoverageInput(assignment?.coverage || '');
    if (assignment?.type === 'medal') {
      setSelectedCategories(assignment.coverage ? assignment.coverage.split(', ') : []);
    } else if (assignment?.type === 'attendance') {
      // Keep track of the selected scope for attendance in a separate state, or reuse coverageInput
      setCoverageInput(assignment.scope || '');
    } else if (assignment?.type === 'judge') {
      setCoverageInput(assignment.scope || '');
      setScopeSubtitleInput(assignment.scopeSubtitle || '');
    }
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

    const updates: any = {
      operator: newName,
      operatorSubtitle: newName !== 'Unassigned' ? assignment.role : null
    };

    if (assignment.type === 'medal') {
      updates.coverage = selectedCategories.join(', ');
    } else if (assignment.type === 'attendance') {
      updates.scope = coverageInput;
    } else if (assignment.type === 'judge') {
      updates.scope = coverageInput;
      updates.scopeSubtitle = scopeSubtitleInput;
    }

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
                        {!isSetupMode ? (
                          <>
                            {s.coverage || 'Not started'}
                            {s.scopeSubtitle && <><br /><span className="staff-meta">{s.scopeSubtitle}</span></>}
                          </>
                        ) : (
                          <span className="staff-meta" style={{ fontStyle: 'italic' }}>Live status hidden during setup</span>
                        )}
                      </td>
                      <td data-label="Actions">
                        {isAdmin && (
                          <div className="staff-actions">
                            <button className="btn btn-ghost" onClick={() => openModal(s.id)}>
                              {s.operator === 'Unassigned' ? 'Assign' : 'Reassign'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          )}

          {/* Judges */}
          {judgeStaff.length > 0 && (
            <section className="staff-card">
              <div className="staff-header">
                <div>
                  <h3>Judges</h3>
                  <p className="text-small">Assign judges to specific mats to allow them access to the judge panel.</p>
                </div>
              </div>
              <div className="table-responsive">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Assigned Mat / Category</th>
                    <th>Judge Name</th>
                    <th>Position</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {judgeStaff.map(s => (
                    <tr key={s.id}>
                      <td data-label="Assigned Mat / Category"><strong>{s.scope}</strong></td>
                      <td data-label="Judge Name" className="staff-name">
                        {s.operator}
                        {s.operatorSubtitle && <><br /><span className="staff-meta">{s.operatorSubtitle}</span></>}
                      </td>
                      <td data-label="Position">
                        {s.scopeSubtitle}
                      </td>
                      <td data-label="Actions">
                        {isAdmin && (
                          <div className="staff-actions">
                            <button className="btn btn-ghost" onClick={() => openModal(s.id)}>
                              {s.operator === 'Unassigned' ? 'Assign' : 'Reassign'}
                            </button>
                          </div>
                        )}
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
                    <th>Assigned Category</th>
                    <th>Volunteer</th>
                    <th>Check-in</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceStaff.map(s => (
                    <tr key={s.id}>
                      <td data-label="Assigned Category">{s.scope}</td>
                      <td data-label="Volunteer" className="staff-name">
                        {s.operator}
                        {s.operatorSubtitle && <><br /><span className="staff-meta">{s.operatorSubtitle}</span></>}
                      </td>
                      <td data-label="Check-in">
                        {!isSetupMode ? (
                          <>
                            <strong>{s.coverage || '0 / 0'}</strong>
                            {s.scopeSubtitle && <><br /><span className="staff-meta">{s.scopeSubtitle}</span></>}
                          </>
                        ) : (
                          <span className="staff-meta" style={{ fontStyle: 'italic' }}>Live status hidden during setup</span>
                        )}
                      </td>
                      <td data-label="Actions">
                        {isAdmin && (
                          <div className="staff-actions">
                            <button className="btn btn-ghost" onClick={() => openModal(s.id)}>
                              {s.operator === 'Unassigned' ? 'Assign' : 'Reassign'}
                            </button>
                          </div>
                        )}
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
                  <p className="text-small">Who is assigned to distribute medals and the categories they cover.</p>
                </div>
              </div>
              <div className="table-responsive">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Distributor</th>
                    <th>Coverage (Categories)</th>
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
                      <td data-label="Coverage">{s.coverage}</td>
                      <td data-label="Actions">
                        {isAdmin && (
                          <div className="staff-actions">
                            <button className="btn btn-ghost" onClick={() => openModal(s.id)}>
                              {s.operator === 'Unassigned' ? 'Assign' : 'Reassign'}
                            </button>
                          </div>
                        )}
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
              {activeAssignment?.type === 'medal' ? (
                <div className="assign-field full">
                  <label>Coverage (Select Categories)</label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1.5px solid var(--neutral-300)', borderRadius: '10px', padding: '12px', background: 'var(--shiro)' }}>
                    {categories.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--neutral-500)', margin: 0 }}>No categories found in this competition.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {categories.map(cat => (
                          <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, textTransform: 'none', letterSpacing: 'normal', color: 'var(--neutral-700)' }}>
                            <input 
                              type="checkbox" 
                              style={{ width: '16px', height: '16px' }}
                              checked={selectedCategories.includes(cat.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCategories(prev => [...prev, cat.name]);
                                } else {
                                  setSelectedCategories(prev => prev.filter(c => c !== cat.name));
                                }
                              }}
                            />
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>{cat.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : activeAssignment?.type === 'attendance' ? (
                <div className="assign-field full">
                  <label>Assigned Category</label>
                  <select value={coverageInput} onChange={e => setCoverageInput(e.target.value)}>
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              ) : activeAssignment?.type === 'judge' ? (
                <>
                  <div className="assign-field">
                    <label>Assigned Mat / Category</label>
                    <select value={coverageInput} onChange={e => setCoverageInput(e.target.value)}>
                      <option value="">Select Mat or Category</option>
                      <optgroup label="Mats">
                        <option value="MAT 01">MAT 01</option>
                        <option value="MAT 02">MAT 02</option>
                        <option value="MAT 03">MAT 03</option>
                        <option value="MAT 04">MAT 04</option>
                        <option value="MAT 05">MAT 05</option>
                        <option value="MAT 06">MAT 06</option>
                        <option value="MAT 07">MAT 07</option>
                        <option value="MAT 08">MAT 08</option>
                      </optgroup>
                      <optgroup label="Categories">
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="assign-field">
                    <label>Position / Judge Number</label>
                    <select value={scopeSubtitleInput} onChange={e => setScopeSubtitleInput(e.target.value)}>
                      <option value="">Select Position</option>
                      <option value="Judge 1">Judge 1</option>
                      <option value="Judge 2">Judge 2</option>
                      <option value="Judge 3">Judge 3</option>
                      <option value="Judge 4">Judge 4</option>
                      <option value="Judge 5">Judge 5</option>
                      <option value="Match Supervisor">Match Supervisor</option>
                      <option value="Tatami Manager">Tatami Manager</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="assign-field full">
                  <label>Assignment scope</label>
                  <input type="text" value={`${activeAssignment?.scope || ''} ${activeAssignment?.scopeSubtitle ? '(' + activeAssignment.scopeSubtitle + ')' : ''}`} disabled />
                </div>
              )}
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
