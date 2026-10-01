'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, Plus, ChevronDown, Award, Users, Tv, Shield } from 'lucide-react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
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

      // Extract pools from matches if available
      (cat.matches || []).forEach((m: any) => {
        const p = m.pool || (m.id && m.id.includes('Pool') ? m.id.split('-')[0].replace('Pool', '') : (m.id && m.id.includes('finals') ? 'finals' : '1'));
        if (p) poolSet.add(p);
      });

      // Fallback: estimate from entries & poolSize
      if (poolSet.size === 0) {
        const numPools = Math.max(1, Math.ceil((cat.entries || 8) / (cat.poolSize || 8)));
        for (let i = 1; i <= numPools; i++) poolSet.add(String(i));
        poolSet.add('finals');
      }

      if (isAttendance) {
        // Attendance option for entire category
        const allPoolsKey = `${catName} (All Pools)`;
        const isAssigned = (member.assignedCategories || []).includes(allPoolsKey) || (member.assignedCategories || []).includes(catName);
        items.push({
          id: allPoolsKey,
          label: allPoolsKey,
          categoryName: catName,
          poolName: 'All Pools',
          isAssignedToThis: isAssigned,
          assigneeName: null,
        });
      }

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
          ? (member.assignedPools || []).includes(itemKey)
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

  // Handle select mat
  const handleSelectMat = async (matId: string) => {
    setLoadingAction(matId);
    try {
      await onAssignMat(member.id, matId);
      setIsOpen(false);
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle select category / pool
  const handleSelectCategoryPool = async (itemKey: string) => {
    setLoadingAction(itemKey);
    try {
      if (isMedals) {
        await onAssignCategoryPool(member.id, 'medal', itemKey);
      } else {
        await onAssignCategoryPool(member.id, 'attendance', itemKey);
      }
      setIsOpen(false);
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
      {/* Current Assignment Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {currentAssignedItems.length === 0 ? (
          <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--neutral-400)' }}>
            Unassigned
          </span>
        ) : (
          currentAssignedItems.map(item => (
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
                gap: '4px',
              }}
            >
              {item.label}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    if (item.type === 'mat') onUnassignMat(member.id, item.id);
                    else if (item.type === 'medal') onUnassignCategoryPool(member.id, 'medal', item.id);
                    else onUnassignCategoryPool(member.id, 'attendance', item.id);
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
          ))
        )}

        {/* Quick Assign Dropdown Trigger */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
              background: isOpen ? 'var(--neutral-200)' : 'var(--neutral-100)',
              color: 'var(--neutral-700)',
              border: '1px solid var(--neutral-300)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={11} />
            <span>Assign {isOperatorOrJudge ? 'Mat' : isMedals ? 'Medals' : 'Attendance'}</span>
            <ChevronDown size={11} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
          </button>
        )}
      </div>

      {/* Floating Popover Search Dropdown */}
      {isOpen && isAdmin && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 100,
            width: '320px',
            background: 'var(--shiro)',
            border: '1.5px solid var(--neutral-300)',
            borderRadius: '10px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
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
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isOperatorOrJudge ? "Search mat number..." : "Search category or pool..."}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: '12px',
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
                    onClick={() => handleSelectMat(opt.id)}
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
                    onClick={() => handleSelectCategoryPool(opt.id)}
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
    </div>
  );
}
