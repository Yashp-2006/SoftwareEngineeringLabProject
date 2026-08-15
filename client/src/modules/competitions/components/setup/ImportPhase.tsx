import React from 'react';
import { FileSpreadsheet, CheckCircle, Plus, Trash2 } from 'lucide-react';

interface ImportPhaseProps {
  poolSize: number;
  setPoolSize: (val: number) => void;
  wkfKataJudgeCount: number;
  setWkfKataJudgeCount: (val: 3 | 5 | 7) => void;
  setCategories: React.Dispatch<React.SetStateAction<any[]>>;
  importResult: any;
  uploading: boolean;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setModalFormData: (val: any) => void;
  setModalType: (val: any) => void;
  manualAthletes: any[];
  setManualAthletes: React.Dispatch<React.SetStateAction<any[]>>;
  handleManualImport: () => void;
}

export default function ImportPhase({
  poolSize, setPoolSize, wkfKataJudgeCount, setWkfKataJudgeCount, setCategories,
  importResult, uploading, handleDrop, handleDragOver, handleFileUpload,
  setModalFormData, setModalType, manualAthletes, setManualAthletes, handleManualImport
}: ImportPhaseProps) {
  return (
    <div className="category-manager">
      <div className="cat-group">
        <h3>Match Pool Size</h3>
        <p className="text-small">Pick a standard pool size. Max supported size is 32.</p>
        <div className="pool-size-options" style={{ marginTop: 'var(--space-4)' }}>
          {([4, 8, 16, 32] as const).map(size => (
            <label key={size} className="pool-size-option">
              <input type="radio" name="pool-size" value={size} checked={poolSize === size} onChange={() => setPoolSize(size)} />
              <span>{size}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="cat-group" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ padding: 'var(--space-3)', background: 'var(--neutral-50)', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: '13px' }}>Kata Judge Count</h4>
          <p className="text-small" style={{ marginBottom: 'var(--space-3)', color: 'var(--neutral-600)' }}>Applies to all generated Kata categories.</p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            {[3, 5, 7].map(count => (
              <label key={count} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="wkfKataJudgeCount" value={count} checked={wkfKataJudgeCount === count} onChange={() => {
                  setWkfKataJudgeCount(count as 3|5|7);
                  setCategories(prev => prev.map(c => 
                    c.name.toLowerCase().includes('kata') ? { ...c, judgeCount: count } : c
                  ));
                }} />
                <span className="text-small">{count} Judges</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="cat-group">
        <div className="flex-between mb-4">
          <div>
            <h3>Tiesheet Data Import</h3>
            <p className="text-small">Upload your CSV or Excel files to automatically generate brackets.</p>
          </div>
        </div>

        <div 
          className="dropzone" 
          onClick={() => document.getElementById('excel-upload')?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
        >
          {importResult ? (
            <>
              <CheckCircle className="dropzone-icon" style={{ color: 'var(--midori, #10b981)' }} />
              <h3 style={{ color: 'var(--midori, #10b981)' }}>Upload Successful!</h3>
              <p className="text-small" style={{ marginBottom: 'var(--space-4)' }}>
                {importResult.categoriesTotal} categories, {importResult.athletesImported} athletes imported.
              </p>
            </>
          ) : (
            <>
              <FileSpreadsheet className="dropzone-icon" />
              <h3>Drag & drop your registration file here</h3>
              <p className="text-small" style={{ marginBottom: 'var(--space-4)' }}>Supports .csv, .xls, .xlsx (Max 10MB)</p>
            </>
          )}
          <button type="button" className="btn btn-primary" disabled={uploading}>
            {uploading ? 'Processing...' : importResult ? 'Upload Another File' : 'Browse Files'}
          </button>
          <input type="file" id="excel-upload" style={{ display: 'none' }} accept=".csv, .xls, .xlsx" onChange={handleFileUpload} />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-5)' }}>
          <button type="button" className="btn btn-secondary" onClick={() => {
            setModalFormData({ name: '', age: '', state: '', academy: '', district: '', weight: '', phone: '', email: '', kata: 'yes', kumite: 'yes', gender: 'Male' });
            setModalType('onspot');
          }}>
            <Plus size={16} /> Add On-Spot Entry
          </button>
        </div>

        {manualAthletes.length > 0 && (
          <div style={{ marginTop: 'var(--space-6)', background: 'var(--shiro)', borderRadius: '12px', padding: 'var(--space-5)', border: '1px solid var(--neutral-300)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h4 style={{ margin: 0 }}>On-Spot Entries ({manualAthletes.length})</h4>
              <button type="button" className="btn btn-primary" onClick={handleManualImport} disabled={uploading}>
                {uploading ? 'Processing...' : 'Import Manual Entries'}
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="cat-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Age</th>
                    <th>Weight</th>
                    <th>Academy</th>
                    <th>Events</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {manualAthletes.map((a, i) => {
                    const events = [];
                    if (a.kata === 'yes') events.push('Kata');
                    if (a.kumite === 'yes') events.push('Kumite');
                    return (
                      <tr key={i}>
                        <td>{a.name}</td>
                        <td>{a.age}</td>
                        <td>{a.weight}kg</td>
                        <td>{a.academy}</td>
                        <td>{events.join(', ')}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="btn btn-ghost" style={{ color: 'var(--status-ended)', padding: '4px' }} onClick={() => {
                            setManualAthletes(prev => prev.filter((_, idx) => idx !== i));
                          }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
