'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, Plus, ChevronDown, Award, Users, Tv, Shield, AlertTriangle } from 'lucide-react';
import { StaffAssignment } from './StaffAssignmentManager';

interface Props {
  member: StaffAssignment;
  competitionId: string;
  matsList: string[];
  categories: any[];
  allStaff: StaffAssignment[];
  onAssignMat: (staffId: string, mat: string) => Promise<void>;
  onUnassignMat: (staffId: string, mat: string) => Promise<void>;
  onAssignCategoryPool: (staffId: string, role: 'attendance' | 'medal', item: string) => Promise<void>;
  onUnassignCategoryPool: (staffId: string, role: 'attendance' | 'medal', item: string) => Promise<void>;
  isAdmin: boolean;
}

export default function StaffAssignmentDropdown({
  member,
  competitionId,
  matsList,
  categories,
  allStaff,
  onAssignMat,
  onUnassignMat,
  onAssignCategoryPool,
  onUnassignCategoryPool,
  isAdmin,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Assignment confirmation modal state
  const [confirmModalData, setConfirmModalData] = useState<{
    actionType: 'assign' | 'unassign';
    item: {
      id: string;
      label: string;
      assigneeName?: string | null;
    };
  } | null>(null);

  const [alignRight, setAlignRight] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if dropdown extends off screen right and clamp
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      if (rect.left + 320 > window.innerWidth - 16) {
        setAlignRight(true);
      } else {
        setAlignRight(false);
      }
    }
  }, [isOpen]);

  // Close dropdown on outside click or tap
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Reset search when opened
  useEffect(() => {
    if (isOpen) setSearchQuery('');
  }, [isOpen]);

  const isOperatorOrJudge = member.role === 'score' || member.role === 'judge';
  const isMedals = member.role === 'medal';
  const isAttendance = member.role === 'attendance';

  // 1. Generate available items for Operator / Judge (Mats)
  const matOptions = useMemo(() => {
    if (!isOperatorOrJudge) return [];
    return matsList.map(mat => {
      const matNum = parseInt(mat.replace(/\D/g, '') || '1', 10);
      const matId = `mat-${matNum}`;
      const matDisplay = `MAT ${String(matNum).padStart(2, '0')}`;
      
      // Check current assignee
      const assignee = allStaff.find(s => 
        s.id !== member.id && 
        (s.role === member.role) && 
        (s.assignedMats || []).some(m => parseInt(m.replace(/\D/g, ''), 10) === matNum)
      );

      const isAssignedToThis = (member.assignedMats || []).some(
        m => parseInt(m.replace(/\D/g, ''), 10) === matNum
      );

      return {
        id: matId,
        label: matDisplay,
        matNum,
        isAssignedToThis,
        assigneeName: assignee ? assignee.name : null,
      };
    }).filter(opt => 
      opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(opt.matNum).includes(searchQuery)
    );
  }, [isOperatorOrJudge, matsList, allStaff, member, searchQuery]);

  // 2. Generate available items for Medals / Attendance (Categories & Pools)
  const categoryPoolOptions = useMemo(() => {
    if (!isMedals && !isAttendance) return [];
    const items: Array<{
      id: string;
      label: string;
      categoryName: string;
      poolName: string;
      isAssignedToThis: boolean;
      assigneeName: string | null;
    }> = [];

    categories.forEach(cat => {
      const catName = cat.name || cat.id;
      const poolSet = new Set<string>();

      // Check cat.pools array if defined
      if (cat.pools && Array.isArray(cat.pools)) {
        cat.pools.forEach((p: any) => {
          const pid = typeof p === 'string' ? p : (p.pool || p.id || '');
          if (pid) poolSet.add(String(pid));
        });
      }

      // Extract pools from matches if available
      (cat.matches || []).forEach((m: any) => {
        const p = m.pool || (m.id && m.id.includes('Pool') ? m.id.split('-')[0].replace('Pool', '') : (m.id && m.id.includes('finals') ? 'finals' : '1'));
        if (p) poolSet.add(String(p));
      });

      // Fallback: estimate from entries & poolSize
      if (poolSet.size === 0) {
        const numPools = Math.max(1, Math.ceil((cat.entries || 8) / (cat.poolSize || 8)));
        for (let i = 1; i <= numPools; i++) poolSet.add(String(i));
        poolSet.add('finals');
      } else {
        poolSet.add('finals');
      }

      // "All Pools" option for entire category (Available for BOTH Attendance and Medals!)
      const allPoolsKey = `${catName} (All Pools)`;
      const allPoolsLabel = isMedals ? `${catName} (All Pools / Category Medals)` : `${catName} (All Pools)`;
      const isAllPoolsAssigned = isMedals
        ? (member.assignedPools || []).includes(allPoolsKey) ||
          (member.assignedPools || []).includes(allPoolsLabel) ||
          (member.assignedPools || []).includes(catName) ||
          (member.assignedCategories || []).includes(allPoolsKey) ||
          (member.assignedCategories || []).includes(catName)
        : (member.assignedCategories || []).includes(allPoolsKey) ||
          (member.assignedCategories || []).includes(catName);

      items.push({
        id: allPoolsKey,
        label: allPoolsLabel,
        categoryName: catName,
        poolName: isMedals ? 'All Pools (Category Medals)' : 'All Pools',
        isAssignedToThis: isAllPoolsAssigned,
        assigneeName: null,
      });

      // Individual pools
      const sortedPools = Array.from(poolSet).sort((a, b) => {
        if (a === 'finals') return 1;
        if (b === 'finals') return -1;
        return parseInt(a) - parseInt(b);
      });

      sortedPools.forEach(p => {
        const pName = p === 'finals' ? (isMedals ? 'Finals (Medals Ceremony)' : 'Finals') : `Pool ${p}`;
        const itemKey = `${catName} (${pName})`;
        const isAssigned = isMedals 
          ? (member.assignedPools || []).includes(itemKey) || (member.assignedPools || []).includes(`${catName} - ${pName}`)
          : (member.assignedCategories || []).includes(itemKey);

        items.push({
          id: itemKey,
          label: itemKey,
          categoryName: catName,
          poolName: pName,
          isAssignedToThis: isAssigned,
          assigneeName: null,
        });
      });
    });

    return items.filter(opt =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opt.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opt.poolName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [isMedals, isAttendance, categories, member, searchQuery]);

  // Request assignment confirmation for mat
  const handleSelectMat = (matId: string, label: string, assigneeName?: string | null) => {
    setConfirmModalData({
      actionType: 'assign',
      item: {
        id: matId,
        label,
        assigneeName,
      },
    });
    setIsOpen(false);
  };

  // Request assignment confirmation for category / pool
  const handleSelectCategoryPool = (itemKey: string, label: string) => {
    setConfirmModalData({
      actionType: 'assign',
      item: {
        id: itemKey,
        label,
      },
    });
    setIsOpen(false);
  };

  // Execute assignment after confirmation
  const handleExecuteAssign = async (itemId: string) => {
    setLoadingAction(itemId);
    try {
      if (isOperatorOrJudge) {
        await onAssignMat(member.id, itemId);
      } else if (isMedals) {
        await onAssignCategoryPool(member.id, 'medal', itemId);
      } else {
        await onAssignCategoryPool(member.id, 'attendance', itemId);
      }
      setConfirmModalData(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  // Execute unassignment after confirmation
  const handleExecuteUnassign = async (itemId: string) => {
    setLoadingAction(itemId);
    try {
      if (isOperatorOrJudge) {
        await onUnassignMat(member.id, itemId);
      } else if (isMedals) {
        await onUnassignCategoryPool(member.id, 'medal', itemId);
      } else {
        await onUnassignCategoryPool(member.id, 'attendance', itemId);
      }
      setConfirmModalData(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  // Active items to display as badges
  const currentAssignedItems = useMemo(() => {
    if (isOperatorOrJudge) {
      return (member.assignedMats || []).map(mat => {
        const num = mat.replace(/\D/g, '').padStart(2, '0');
        return {
          id: mat,
          label: `MAT ${num}`,
          type: 'mat' as const,
        };
      });
    }
    if (isAttendance) {
      return (member.assignedCategories || []).map(cat => ({
        id: cat,
        label: cat,
        type: 'attendance' as const,
      }));
    }
    if (isMedals) {
      return (member.assignedPools || []).map(pool => ({
        id: pool,
        label: pool,
        type: 'medal' as const,
      }));
    }
    return [];
  }, [member, isOperatorOrJudge, isAttendance, isMedals]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Current Assignment display */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {currentAssignedItems.length === 0 ? (
          /* When unassigned: ONLY ONE element shown */
          isAdmin ? (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '6px',
                background: isOpen ? 'var(--neutral-200)' : 'var(--neutral-100)',
                color: 'var(--neutral-600)',
                border: '1px dashed var(--neutral-300)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontStyle: 'italic', color: 'var(--neutral-500)' }}>Unassigned</span>
              <ChevronDown
                size={12}
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  color: 'var(--neutral-400)',
                }}
              />
            </button>
          ) : (
            <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--neutral-400)' }}>
              Unassigned
            </span>
          )
        ) : (
          /* When assigned: show what is assigned */
          <>
            {currentAssignedItems.map(item => (
              <span
                key={item.id}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  background: isOperatorOrJudge ? '#ecfdf5' : isMedals ? '#fef3c7' : '#eff6ff',
                  color: isOperatorOrJudge ? '#065f46' : isMedals ? '#92400e' : '#1e40af',
                  border: `1px solid ${isOperatorOrJudge ? '#a7f3d0' : isMedals ? '#fde68a' : '#bfdbfe'}`,
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isOperatorOrJudge && isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'inherit',
                      fontWeight: 700,
                      fontSize: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Click to change mat assignment"
                  >
                    <span>{item.label}</span>
                    <ChevronDown
                      size={11}
                      style={{
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>
                ) : (
                  <span>{item.label}</span>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmModalData({
                        actionType: 'unassign',
                        item: { id: item.id, label: item.label },
                      });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'currentColor',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.7,
                    }}
                    title="Remove assignment"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}

            {/* Multi-assignment roles (Medals / Attendance) can optionally add more */}
            {!isOperatorOrJudge && isAdmin && (
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: '5px',
                  background: isOpen ? 'var(--neutral-200)' : 'var(--neutral-100)',
                  color: 'var(--neutral-700)',
                  border: '1px solid var(--neutral-300)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
                title="Add another assignment"
              >
                <Plus size={11} />
                <span>Add</span>
                <ChevronDown size={10} style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Floating Popover Search Dropdown */}
      {isOpen && isAdmin && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: alignRight ? 'auto' : 0,
            right: alignRight ? 0 : 'auto',
            zIndex: 300,
            width: 'min(320px, calc(100vw - 32px))',
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--shiro)',
            border: '1.5px solid var(--neutral-300)',
            borderRadius: '10px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* Search Header */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--neutral-200)', background: 'var(--neutral-50)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} color="var(--neutral-400)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isOperatorOrJudge ? "Search mat number..." : "Search category or pool..."}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: '14px',
                outline: 'none',
                color: 'var(--neutral-800)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--neutral-400)' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px' }}>
            {/* Operator / Judge Mats */}
            {isOperatorOrJudge && (
              matOptions.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--neutral-400)' }}>
                  No matching mats found
                </div>
              ) : (
                matOptions.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={loadingAction === opt.id}
                    onClick={() => handleSelectMat(opt.id, opt.label, opt.assigneeName)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: opt.isAssignedToThis ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!opt.isAssignedToThis) e.currentTarget.style.background = 'var(--neutral-100)';
                    }}
                    onMouseLeave={(e) => {
                      if (!opt.isAssignedToThis) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, color: opt.isAssignedToThis ? '#047857' : 'var(--neutral-900)' }}>
                        {opt.label}
                      </span>
                      {opt.assigneeName && (
                        <span style={{ fontSize: '10px', color: 'var(--neutral-500)', background: 'var(--neutral-100)', padding: '1px 5px', borderRadius: '4px' }}>
                          Occupied: {opt.assigneeName}
                        </span>
                      )}
                      {!opt.assigneeName && !opt.isAssignedToThis && (
                        <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>
                          ● Available
                        </span>
                      )}
                    </div>
                    {opt.isAssignedToThis && <Check size={14} color="#10b981" />}
                  </button>
                ))
              )
            )}

            {/* Medals & Attendance (Category & Pool Options) */}
            {(isMedals || isAttendance) && (
              categoryPoolOptions.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--neutral-400)' }}>
                  No matching categories or pools found
                </div>
              ) : (
                categoryPoolOptions.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={loadingAction === opt.id}
                    onClick={() => handleSelectCategoryPool(opt.id, opt.label)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: opt.isAssignedToThis ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      transition: 'background 0.12s ease',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      if (!opt.isAssignedToThis) e.currentTarget.style.background = 'var(--neutral-100)';
                    }}
                    onMouseLeave={(e) => {
                      if (!opt.isAssignedToThis) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <span style={{ fontWeight: 700, color: 'var(--neutral-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {opt.categoryName}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: isMedals ? '#d97706' : '#2563eb' }}>
                        {opt.poolName}
                      </span>
                    </div>
                    {opt.isAssignedToThis && <Check size={14} color="#2563eb" style={{ flexShrink: 0 }} />}
                  </button>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {mounted && confirmModalData && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => !loadingAction && setConfirmModalData(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid var(--neutral-300)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              width: 'min(420px, 92vw)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: confirmModalData.actionType === 'assign' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(217, 38, 44, 0.12)',
                  color: confirmModalData.actionType === 'assign' ? '#059669' : '#dc2626',
                  flexShrink: 0,
                }}
              >
                {confirmModalData.actionType === 'assign' ? <Check size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--neutral-900)' }}>
                  {confirmModalData.actionType === 'assign' ? 'Confirm Assignment' : 'Remove Assignment'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--neutral-500)', margin: 0 }}>
                  {confirmModalData.actionType === 'assign' ? 'Please confirm this staff assignment' : 'Please confirm removal of this assignment'}
                </p>
              </div>
            </div>

            <div style={{ fontSize: '14px', color: 'var(--neutral-700)', lineHeight: 1.5, background: 'var(--neutral-50)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--neutral-200)' }}>
              {confirmModalData.actionType === 'assign' ? (
                <div>
                  Assign <strong>{member.name}</strong> to <strong>{confirmModalData.item.label}</strong>?
                </div>
              ) : (
                <div>
                  Remove <strong>{confirmModalData.item.label}</strong> assignment from <strong>{member.name}</strong>?
                </div>
              )}

              {confirmModalData.actionType === 'assign' && confirmModalData.item.assigneeName && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#b45309', background: '#fef3c7', padding: '6px 8px', borderRadius: '6px', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>Currently occupied by <strong>{confirmModalData.item.assigneeName}</strong>. This will reassign it.</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() => setConfirmModalData(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() => {
                  if (confirmModalData.actionType === 'assign') {
                    handleExecuteAssign(confirmModalData.item.id);
                  } else {
                    handleExecuteUnassign(confirmModalData.item.id);
                  }
                }}
                className={confirmModalData.actionType === 'assign' ? 'btn btn-primary' : 'confirm-btn-danger'}
                style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {loadingAction !== null ? 'Saving...' : confirmModalData.actionType === 'assign' ? 'Confirm Assignment' : 'Remove'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
