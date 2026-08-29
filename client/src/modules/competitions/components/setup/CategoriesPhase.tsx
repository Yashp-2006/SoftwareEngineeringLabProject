import React from 'react';
import { Download, UploadCloud, RefreshCw, Combine, Plus, Search, GripVertical, Edit2, Trash2 } from 'lucide-react';
import DateRangePicker from '@/modules/shared/components/DateRangePicker';

interface CategoriesPhaseProps {
  compDate: string;
  setCompDate: (val: string) => void;
  tournamentDays: number;
  setTournamentDays: (val: number) => void;
  compStartTime: string;
  setCompStartTime: (val: string) => void;
  compEndTime: string;
  setCompEndTime: (val: string) => void;
  compEstMinsPerPool: number;
  setCompEstMinsPerPool: (val: number) => void;
  globalMatchTime: number;
  setGlobalMatchTime: (val: number) => void;
  globalRestTime: number;
  setGlobalRestTime: (val: number) => void;
  globalMedicalTime: number;
  setGlobalMedicalTime: (val: number) => void;
  globalBunkaiTime: number;
  setGlobalBunkaiTime: (val: number) => void;

  handleExportPreset: () => void;
  handleImportPreset: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLoadWkfCategories: () => void;
  setModalType: (val: any) => void;

  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterGender: string;
  setFilterGender: (val: any) => void;
  filterDiscipline: string;
  setFilterDiscipline: (val: any) => void;
  hideEmpty: boolean;
  setHideEmpty: (val: boolean) => void;

  filteredCategories: any[];
  categories: any[];
  setCategories: React.Dispatch<React.SetStateAction<any[]>>;
  
  dragIdx: number | null;
  dragOverIdx: number | null;
  handleDragStart: (e: any, idx: number) => void;
  handleRowDragOver: (e: any, idx: number) => void;
  handleRowDrop: (e: any, dropIdx: number) => void;

  wkfKataJudgeCount: number;
  setEditCatId: (val: string) => void;
  setEditCatName: (val: string) => void;
  setEditCatData: (val: any) => void;
}

export default function CategoriesPhase({
  compDate, setCompDate, tournamentDays, setTournamentDays, compStartTime, setCompStartTime,
  compEndTime, setCompEndTime, compEstMinsPerPool, setCompEstMinsPerPool,
  globalMatchTime, setGlobalMatchTime, globalRestTime, setGlobalRestTime,
  globalMedicalTime, setGlobalMedicalTime, globalBunkaiTime, setGlobalBunkaiTime,
  handleExportPreset, handleImportPreset, handleLoadWkfCategories, setModalType,
  searchQuery, setSearchQuery, filterGender, setFilterGender, filterDiscipline, setFilterDiscipline,
  hideEmpty, setHideEmpty, filteredCategories, categories, setCategories,
  dragIdx, dragOverIdx, handleDragStart, handleRowDragOver, handleRowDrop,
  wkfKataJudgeCount, setEditCatId, setEditCatName, setEditCatData
}: CategoriesPhaseProps) {
  return (
    <div className="category-manager">
      <div className="cat-group" style={{ marginBottom: 'var(--space-4)' }}>
        <h3>Schedule Configuration</h3>
        <p className="text-small mb-4">Set up days and global time estimates for scheduling pools.</p>
        
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="text-micro">Start Date</label>
            <input type="date" className="input-field" value={compDate.split(' to ')[0] || compDate} onChange={e => {
              const start = e.target.value;
              const end = compDate.split(' to ')[1] || start;
              setCompDate(`${start} to ${end}`);
              const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 3600 * 24)) + 1;
              setTournamentDays(days > 0 ? days : 1);
            }} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="text-micro">End Date</label>
            <input type="date" className="input-field" value={compDate.split(' to ')[1] || ''} onChange={e => {
              const start = compDate.split(' to ')[0] || compDate;
              const end = e.target.value;
              setCompDate(`${start} to ${end}`);
              const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 3600 * 24)) + 1;
              setTournamentDays(days > 0 ? days : 1);
            }} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="text-micro">Computed Days</label>
            <input type="number" readOnly className="input-field" style={{ background: '#f5f5f5', cursor: 'not-allowed' }} value={tournamentDays} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="text-micro">Start Time</label>
            <input type="time" className="input-field" value={compStartTime} onChange={e => setCompStartTime(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="text-micro">End Time</label>
            <input type="time" className="input-field" value={compEndTime} onChange={e => setCompEndTime(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="text-micro">Est. Min / Pool</label>
            <input type="number" min="5" className="input-field" value={compEstMinsPerPool} onChange={e => setCompEstMinsPerPool(parseInt(e.target.value) || 45)} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="text-micro">Match Time (mins)</label>
            <input type="number" min="0" className="input-field" value={globalMatchTime} onChange={e => setGlobalMatchTime(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="text-micro">Rest/Buffer (mins)</label>
            <input type="number" min="0" className="input-field" value={globalRestTime} onChange={e => setGlobalRestTime(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="text-micro">Medical Time (mins)</label>
            <input type="number" min="0" className="input-field" value={globalMedicalTime} onChange={e => setGlobalMedicalTime(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="text-micro">Bunkai Buffer (mins)</label>
            <input type="number" min="0" className="input-field" value={globalBunkaiTime} onChange={e => setGlobalBunkaiTime(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      </div>

      <div className="cat-group">
        <div className="flex-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ minWidth: '200px' }}>
            <h3>Categories</h3>
            <p className="text-small">Divisions for the tournament.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" style={{ height: '36px', padding: '0 12px' }} onClick={handleExportPreset}>
              <Download size={16} /> Export
            </button>
            <button type="button" className="btn btn-ghost" style={{ height: '36px', padding: '0 12px' }} onClick={() => document.getElementById('preset-upload')?.click()}>
              <UploadCloud size={16} /> Import
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleLoadWkfCategories} style={{ color: 'var(--ao)', borderColor: 'var(--ao)', height: '36px', padding: '0 12px' }}>
              <RefreshCw size={16} /> Load WKF Rules
            </button>
            <input type="file" id="preset-upload" style={{ display: 'none' }} accept=".json" onChange={handleImportPreset} />
            <button type="button" className="btn btn-ghost" style={{ height: '36px', padding: '0 12px' }} onClick={() => setModalType('merge')}>
              <Combine size={16} /> Merge
            </button>
            <button type="button" className="btn btn-secondary" style={{ height: '36px', padding: '0 12px' }} onClick={() => setModalType('standard')}>
              <Plus size={16} /> Add Category
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: 'var(--shiro)', border: '1px solid var(--neutral-300)', borderRadius: '8px', padding: '0 12px', height: '36px', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ color: 'var(--neutral-500)', marginRight: '8px' }} />
            <input 
              type="text" 
              placeholder="Search categories..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '14px' }}
            />
          </div>
          <select className="input-field" style={{ width: '160px', height: '36px', marginBottom: 0 }} value={filterGender} onChange={e => setFilterGender(e.target.value as any)}>
            <option value="all">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <select className="input-field" style={{ width: '160px', height: '36px', marginBottom: 0 }} value={filterDiscipline} onChange={e => setFilterDiscipline(e.target.value as any)}>
            <option value="all">All Disciplines</option>
            <option value="kata">Kata Only</option>
            <option value="kumite">Kumite Only</option>
          </select>

        </div>

        <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table className="cat-table">
            <thead style={{ position: 'sticky', top: 0, background: 'var(--shiro)', zIndex: 10 }}>
              <tr>
                <th style={{ width: '32px' }}></th>
                <th>Category Name</th>
                <th>Discipline</th>
                <th>Requirements</th>
                <th>Entries</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((cat, idx) => (
                <tr 
                  key={cat.id || idx}
                  draggable
                  onDragStart={e => handleDragStart(e, idx)}
                  onDragOver={e => handleRowDragOver(e, idx)}
                  onDrop={e => handleRowDrop(e, idx)}
                  style={{ 
                    opacity: dragIdx === idx ? 0.5 : 1,
                    borderTop: dragOverIdx === idx && dragIdx !== null && dragIdx > idx ? '2px solid var(--ao)' : 'none',
                    borderBottom: dragOverIdx === idx && dragIdx !== null && dragIdx < idx ? '2px solid var(--ao)' : 'none',
                    cursor: 'move'
                  }}
                >
                  <td style={{ color: 'var(--neutral-400)', cursor: 'grab' }}><GripVertical size={16} /></td>
                  <td style={{ fontWeight: 500 }}>{cat.name}</td>
                  <td>
                    <span className="status-chip status-live" style={{ background: cat.discipline === 'Kata' ? '#eff6ff' : '#fff1f2', color: cat.discipline === 'Kata' ? '#1d4ed8' : '#be123c', fontSize: '10px', padding: '2px 6px', marginRight: '4px', borderRadius: '4px', fontWeight: 700 }}>
                        {cat.discipline || 'Kumite'}
                      </span>
                  </td>
                  <td>
                    <>
                        {cat.gender && cat.gender !== 'Any' && <span className="status-chip status-live" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}>{cat.gender}</span>}
                        {(cat.minAge !== undefined || cat.maxAge !== undefined) && <span className="status-chip status-live" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}>Age: {cat.minAge || 0}-{cat.maxAge || 99}</span>}
                        {(cat.minWeight !== undefined || cat.maxWeight !== undefined) && <span className="status-chip status-live" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}>Weight: {cat.minWeight || 0}-{cat.maxWeight || 300}kg</span>}
                      </>
                    {(cat.isKata || cat.name.toLowerCase().includes('kata')) && (
                      <div style={{ marginTop: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, marginRight: '8px' }}>Judges:</span>
                        {[3, 5, 7].map(count => (
                          <label key={count} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginRight: '8px', fontSize: '11px' }}>
                            <input 
                              type="radio" 
                              name={`judgeCount-${cat.id || idx}`} 
                              value={count} 
                              checked={(cat.judgeCount || wkfKataJudgeCount || 3) === count} 
                              onChange={() => {
                                setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, judgeCount: count } : c));
                              }} 
                            />
                            {count}
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{cat.entries}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => {
                      setEditCatId(cat.id);
                      setEditCatName(cat.name);
                      setEditCatData({ ...cat });
                      setModalType('editCategory');
                    }}><Edit2 size={16} /></button>
                    <button type="button" className="btn btn-ghost" style={{ padding: '4px', color: 'var(--aka)' }} onClick={() => setCategories(categories.filter(c => c.id !== cat.id))}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--neutral-500)', padding: 'var(--space-6)' }}>
                    No categories found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
