'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Trash2, UserPlus, ShieldCheck, X, Check, Key, ShieldAlert } from 'lucide-react';
import { db } from '@lib/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, query, getDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { gsap } from 'gsap';

export interface StaffAssignment {
  id: string;
  name: string;
  role: 'score' | 'attendance' | 'medal';
  type?: 'score' | 'attendance' | 'medal';
  email?: string;
  pin?: string;
  assignedMats?: string[];
  assignedCategories?: string[];
  assignedPools?: string[];
  approvalStatus?: 'pending' | 'approved' | 'declined' | null;
  requestUserId?: string;
  userId?: string;
  lastActiveAt?: string;
}

export default function StaffAssignmentManager({ competitionId, isSetupMode = false }: { competitionId: string, isSetupMode?: boolean }) {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  
  const [staffData, setStaffData] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [matsList, setMatsList] = useState<string[]>([]);
  const [globalPoolSize, setGlobalPoolSize] = useState(8);

  // Form states for adding a new roster member
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'score' | 'attendance' | 'medal'>('score');
  const [newEmail, setNewEmail] = useState('');
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    let unsub: () => void;
    const setup = async () => {
      try {
        const compSnap = await getDoc(doc(db, 'competitions', competitionId));
        if (compSnap.exists()) {
          const compVal = compSnap.data();
          const matsCount = compVal.mats || 8;
          setGlobalPoolSize(compVal.poolSize || 8);
          const matsArray = Array.from({ length: matsCount }, (_, i) => `MAT ${(i + 1).toString().padStart(2, '0')}`);
          setMatsList(matsArray);
        }

        const staffQ = query(collection(db, 'competitions', competitionId, 'staff'));
        unsub = onSnapshot(staffQ, (snap) => {
          const staff = snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          })) as StaffAssignment[];
          setStaffData(staff);
          setLoading(false);
        });

        const catSnap = await getDocs(collection(db, 'competitions', competitionId, 'categories'));
        const cats = catSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || doc.id,
            entries: data.entries || data.athletes?.length || 0,
            poolSize: data.poolSize || 8
          };
        }).filter(cat => cat.entries > 0); // Hide empty categories
        setCategories(cats);

      } catch (e) {
        console.error('Failed to setup Staff Manager', e);
        setLoading(false);
      }
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

  const generateSinglePin = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setNewPin(randomPin);
  };

  const handleAutoAssignAllPins = async () => {
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      let updatedCount = 0;
      const existingPins = new Set(staffData.map(s => s.pin).filter(Boolean));
      
      for (const member of staffData) {
        if (!member.pin) {
          let randomPin = '';
          do {
            randomPin = Math.floor(1000 + Math.random() * 9000).toString();
          } while (existingPins.has(randomPin));
          
          existingPins.add(randomPin);
          const memberRef = doc(db, 'competitions', competitionId, 'staff', member.id);
          batch.update(memberRef, { pin: randomPin });
          updatedCount++;
        }
      }
      
      if (updatedCount > 0) {
        await batch.commit();
        toast.success(`Automatically assigned PINs to ${updatedCount} staff members!`);
      } else {
        toast.success('All staff members already have PINs configured.');
      }
    } catch (err) {
      console.error('Failed to auto assign PINs:', err);
      toast.error('Failed to automatically assign PINs.');
    }
  };

  const handleAddRosterMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const newStaffId = 'staff-' + Math.random().toString(36).substr(2, 9);
      const newStaffRef = doc(db, 'competitions', competitionId, 'staff', newStaffId);
      
      const payload: StaffAssignment = {
        id: newStaffId,
        name: newName.trim(),
        role: newRole,
        type: newRole,
        email: newEmail.trim() || undefined,
        pin: newPin.trim() || undefined,
        assignedMats: [],
        assignedCategories: [],
        assignedPools: [],
        approvalStatus: null
      };

      await setDoc(newStaffRef, payload);
      toast.success('Roster member added successfully!');
      
      setNewName('');
      setNewEmail('');
      setNewPin('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add roster member.');
    }
  };

  const handleDeleteRosterMember = async (id: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await deleteDoc(doc(db, 'competitions', competitionId, 'staff', id));
      toast.success('Roster member removed.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove roster member.');
    }
  };

  const handleApproveRequest = async (staffId: string, reqUserId: string) => {
    try {
      const staffRef = doc(db, 'competitions', competitionId, 'staff', staffId);
      await updateDoc(staffRef, {
        approvalStatus: 'approved',
        userId: reqUserId
      });
      toast.success('Access request approved!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve request.');
    }
  };

  const handleDeclineRequest = async (staffId: string) => {
    try {
      const staffRef = doc(db, 'competitions', competitionId, 'staff', staffId);
      await updateDoc(staffRef, {
        approvalStatus: 'declined',
        requestUserId: null
      });
      toast.success('Access request declined.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to decline request.');
    }
  };

  const assignTask = async (
    taskType: 'mat' | 'category' | 'pool',
    taskKey: string,
    newRosterId: string
  ) => {
    try {
      // 1. Remove task key from previous owner
      for (const s of staffData) {
        let needsUpdate = false;
        const updates: any = {};
        
        if (taskType === 'mat' && s.assignedMats?.includes(taskKey)) {
          updates.assignedMats = s.assignedMats.filter(m => m !== taskKey);
          needsUpdate = true;
        } else if (taskType === 'category' && s.assignedCategories?.includes(taskKey)) {
          updates.assignedCategories = s.assignedCategories.filter(c => c !== taskKey);
          needsUpdate = true;
        } else if (taskType === 'pool' && s.assignedPools?.includes(taskKey)) {
          updates.assignedPools = s.assignedPools.filter(p => p !== taskKey);
          needsUpdate = true;
        }

        if (needsUpdate) {
          const docRef = doc(db, 'competitions', competitionId, 'staff', s.id);
          await updateDoc(docRef, updates);
        }
      }

      // 2. Add task key to new owner
      if (newRosterId) {
        const targetStaff = staffData.find(s => s.id === newRosterId);
        if (targetStaff) {
          const docRef = doc(db, 'competitions', competitionId, 'staff', newRosterId);
          if (taskType === 'mat') {
            await updateDoc(docRef, {
              assignedMats: [...(targetStaff.assignedMats || []), taskKey]
            });
          } else if (taskType === 'category') {
            await updateDoc(docRef, {
              assignedCategories: [...(targetStaff.assignedCategories || []), taskKey]
            });
          } else if (taskType === 'pool') {
            await updateDoc(docRef, {
              assignedPools: [...(targetStaff.assignedPools || []), taskKey]
            });
          }
        }
      }
      toast.success('Assignment updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update assignment.');
    }
  };

  const pendingRequests = staffData.filter(s => s.approvalStatus === 'pending' && s.requestUserId);
  const matOperators = staffData.filter(s => s.role === 'score');
  const attendanceVolunteers = staffData.filter(s => s.role === 'attendance');
  const medalDistributors = staffData.filter(s => s.role === 'medal');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .staff-stack {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
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
          vertical-align: middle;
        }
        .staff-table tr:last-child td {
          border-bottom: none;
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }
        .form-field label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--neutral-500);
          margin-bottom: 6px;
        }
        .form-field input,
        .form-field select {
          width: 100%;
          height: 40px;
          border-radius: 8px;
          border: 1.5px solid var(--neutral-300);
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          background: #fff;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-badge.online { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-badge.pending { background: rgba(245,158,11,0.1); color: #d97706; }
        .status-badge.offline { background: var(--neutral-100); color: var(--neutral-500); }
        .grid-layout {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        .assignment-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid var(--neutral-100);
        }
        .assignment-row:last-child {
          border-bottom: none;
        }
        .assignment-select {
          height: 36px;
          border-radius: 6px;
          border: 1.5px solid var(--neutral-300);
          padding: 0 8px;
          font-size: 13px;
          background: #fff;
          outline: none;
          max-width: 180px;
        }
      `}} />

      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--neutral-500)' }}>
          Loading staff and roster configurations...
        </div>
      ) : (
        <div className="staff-stack">
          {/* Access Requests Queue */}
          {pendingRequests.length > 0 && (
            <section className="staff-card" style={{ border: '1.5px solid var(--ao)', background: 'rgba(26,77,181,0.02)' }}>
              <div className="staff-header" style={{ marginBottom: '16px' }}>
                <div>
                  <h3 style={{ color: 'var(--ao)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={20} /> Access Requests Queue
                  </h3>
                  <p className="text-small">Live connection requests that require organizer approval to enter the consoles.</p>
                </div>
              </div>
              <div className="table-responsive">
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Login Detail</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map(req => (
                      <tr key={req.id}>
                        <td><strong>{req.name}</strong></td>
                        <td>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--neutral-600)' }}>
                            {req.role === 'score' ? 'Mat Operator' : req.role === 'attendance' ? 'Attendance' : 'Medals'}
                          </span>
                        </td>
                        <td>{req.email ? `Email: ${req.email}` : 'Quick PIN Login'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => handleDeclineRequest(req.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                              <X size={14} style={{ marginRight: '4px' }} /> Decline
                            </button>
                            <button onClick={() => handleApproveRequest(req.id, req.requestUserId!)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                              <Check size={14} style={{ marginRight: '4px' }} /> Approve
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

          {/* Roster Management */}
          <section className="staff-card">
            <div className="staff-header">
              <div>
                <h3>Staff Roster Manager</h3>
                <p className="text-small">Create and maintain the central staff roster list. Define their login credential type.</p>
              </div>
            </div>

            {isAdmin && (
              <form onSubmit={handleAddRosterMember} style={{ background: 'var(--neutral-50)', padding: '16px', borderRadius: '8px', border: '1px solid var(--neutral-200)', marginBottom: '24px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-600)', marginBottom: '12px' }}>Add Roster Member</h4>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Display Name</label>
                    <input type="text" required placeholder="e.g. John Doe" value={newName} onChange={e => setNewName(e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Role</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value as any)}>
                      <option value="score">Mat Operator</option>
                      <option value="attendance">Attendance Volunteer</option>
                      <option value="medal">Medal Distributor</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Email (For Google/Email Login)</label>
                    <input type="email" placeholder="john@example.com (optional)" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>PIN (4-Digits for Quick Login)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" maxLength={4} placeholder="e.g. 1234 (optional)" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} style={{ flex: 1 }} />
                      <button type="button" onClick={generateSinglePin} className="btn btn-secondary" style={{ height: '40px', padding: '0 12px', fontSize: '13px' }}>
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button type="button" onClick={handleAutoAssignAllPins} className="btn btn-secondary" style={{ height: '40px' }}>
                    <Key size={16} style={{ marginRight: '6px' }} /> Auto-Assign All PINs
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ height: '40px' }}>
                    <UserPlus size={16} style={{ marginRight: '6px' }} /> Add to Roster
                  </button>
                </div>
              </form>
            )}

            <div className="table-responsive">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Credentials</th>
                    <th>Status</th>
                    <th>Current Assignments</th>
                    {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {staffData.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', color: 'var(--neutral-500)', padding: '24px' }}>
                        No staff registered. Add staff members above.
                      </td>
                    </tr>
                  ) : (
                    staffData.map(member => (
                      <tr key={member.id} className="staff-card-row">
                        <td><strong>{member.name}</strong></td>
                        <td>
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>
                            {member.role === 'score' ? 'Mat Operator' : member.role === 'attendance' ? 'Attendance' : 'Medals'}
                          </span>
                        </td>
                        <td>
                          {member.email && <div style={{ fontSize: '13px', color: 'var(--neutral-600)' }}>Email: {member.email}</div>}
                          {member.pin && <div style={{ fontSize: '13px', color: 'var(--neutral-600)', display: 'flex', alignItems: 'center', gap: '4px' }}><Key size={12} /> PIN: {member.pin}</div>}
                          {!member.email && !member.pin && <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--neutral-400)' }}>None configured</span>}
                        </td>
                        <td>
                          {member.approvalStatus === 'approved' ? (
                            <span className="status-badge online">Approved</span>
                          ) : member.approvalStatus === 'pending' ? (
                            <span className="status-badge pending">Pending</span>
                          ) : (
                            <span className="status-badge offline">Offline</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {member.role === 'score' && (member.assignedMats || []).map(mat => (
                              <span key={mat} style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', background: 'var(--neutral-100)', borderRadius: '4px' }}>{mat}</span>
                            ))}
                            {member.role === 'attendance' && (member.assignedCategories || []).map(cat => (
                              <span key={cat} style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', background: 'var(--neutral-100)', borderRadius: '4px' }}>{cat}</span>
                            ))}
                            {member.role === 'medal' && (member.assignedPools || []).map(pool => (
                              <span key={pool} style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', background: 'var(--neutral-100)', borderRadius: '4px' }}>{pool}</span>
                            ))}
                            {((member.role === 'score' && (!member.assignedMats || member.assignedMats.length === 0)) ||
                              (member.role === 'attendance' && (!member.assignedCategories || member.assignedCategories.length === 0)) ||
                              (member.role === 'medal' && (!member.assignedPools || member.assignedPools.length === 0))) && (
                              <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--neutral-400)' }}>Unassigned</span>
                            )}
                          </div>
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={() => handleDeleteRosterMember(member.id)} className="btn btn-ghost" style={{ padding: '6px', color: 'var(--aka)' }}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Interactive Assignments */}
          <div className="grid-layout">
            
            {/* Mat Operators assignments */}
            <section className="staff-card">
              <h3 style={{ marginBottom: '4px' }}>Mat Operators Mapping</h3>
              <p className="text-small" style={{ marginBottom: '16px' }}>Assign roster operators to control the scoring consoles for active mats.</p>
              <div>
                {matsList.map(mat => {
                  const assignedOp = matOperators.find(o => o.assignedMats?.includes(mat));
                  return (
                    <div key={mat} className="assignment-row">
                      <span><strong>{mat}</strong></span>
                      <select
                        className="assignment-select"
                        value={assignedOp?.id || ''}
                        disabled={!isAdmin}
                        onChange={e => assignTask('mat', mat, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {matOperators.map(op => (
                          <option key={op.id} value={op.id}>{op.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Attendance Volunteers Mapping */}
            <section className="staff-card">
              <h3 style={{ marginBottom: '4px' }}>Attendance Volunteers Mapping</h3>
              <p className="text-small" style={{ marginBottom: '16px' }}>Assign staff to manage check-in for specific active categories.</p>
              <div style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                {categories.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--neutral-500)', fontStyle: 'italic' }}>No active categories loaded.</p>
                ) : (
                  categories.map(cat => {
                    const assignedVol = attendanceVolunteers.find(v => v.assignedCategories?.includes(cat.name));
                    return (
                      <div key={cat.id} className="assignment-row">
                        <span style={{ fontSize: '13px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cat.name}>
                          <strong>{cat.name}</strong> <span style={{ fontSize: '11px', color: 'var(--neutral-400)' }}>({cat.entries} entries)</span>
                        </span>
                        <select
                          className="assignment-select"
                          value={assignedVol?.id || ''}
                          disabled={!isAdmin}
                          onChange={e => assignTask('category', cat.name, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {attendanceVolunteers.map(vol => (
                            <option key={vol.id} value={vol.id}>{vol.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Medal Distributors Mapping */}
            <section className="staff-card">
              <h3 style={{ marginBottom: '4px' }}>Medal Distributors Mapping</h3>
              <p className="text-small" style={{ marginBottom: '16px' }}>Map distributors to specific pool medals (e.g. Pool 1, Finals).</p>
              <div style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                {categories.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--neutral-500)', fontStyle: 'italic' }}>No active categories loaded.</p>
                ) : (
                  categories.map(cat => {
                    const poolCount = Math.ceil(cat.entries / (cat.poolSize || globalPoolSize || 8));
                    const pools = Array.from({ length: poolCount }, (_, index) => `${cat.name} - Pool ${index + 1}`);
                    
                    return (
                      <div key={cat.id} style={{ borderBottom: '1px solid var(--neutral-200)', paddingBottom: '8px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-500)', marginBottom: '4px' }}>{cat.name}</div>
                        {pools.map(poolName => {
                          const assignedDist = medalDistributors.find(d => d.assignedPools?.includes(poolName));
                          const displayName = poolName.replace(`${cat.name} - `, '');
                          
                          return (
                            <div key={poolName} className="assignment-row" style={{ paddingLeft: '8px', borderBottom: 'none' }}>
                              <span style={{ fontSize: '13px' }}>{displayName}</span>
                              <select
                                className="assignment-select"
                                value={assignedDist?.id || ''}
                                disabled={!isAdmin}
                                onChange={e => assignTask('pool', poolName, e.target.value)}
                              >
                                <option value="">Unassigned</option>
                                {medalDistributors.map(dist => (
                                  <option key={dist.id} value={dist.id}>{dist.name}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

          </div>
        </div>
      )}
    </>
  );
}
