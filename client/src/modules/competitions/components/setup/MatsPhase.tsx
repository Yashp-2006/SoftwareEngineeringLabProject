import React from 'react';
import { Trash2, Key, EyeOff, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface MatsPhaseProps {
  matsCount: number | string;
  setMatsCount: (val: any) => void;
  scoreboardLogo: string | null;
  setScoreboardLogo: (val: string | null) => void;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bulkSetMatPasswords: () => void;
  showPasswordMap: Record<number, boolean>;
  togglePassword: (idx: number) => void;
  matPasswordMap: Record<number, string>;
  setMatPasswordMap: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  saveMatPassword: (matIndex: number, pwd: string) => void;
}

export default function MatsPhase({
  matsCount, setMatsCount, scoreboardLogo, setScoreboardLogo, handleLogoUpload,
  bulkSetMatPasswords, showPasswordMap, togglePassword, matPasswordMap, setMatPasswordMap, saveMatPassword
}: MatsPhaseProps) {
  return (
    <>
      <div className="cat-group">
        <div className="flex-between">
          <div>
            <h3>Mats & Capacity</h3>
            <p className="text-small">The mat count drives score operator assignments and security setup.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', marginTop: 'var(--space-4)' }}>
          <div style={{ flex: 1 }}>
            <label className="text-micro" style={{ display: 'block', marginBottom: '8px' }}>Total Active Mats</label>
            <input 
              type="number" 
              className="input-field" 
              value={matsCount} 
              onChange={e => {
                const val = e.target.value;
                if (val === '') {
                  setMatsCount('' as any);
                } else {
                  const parsed = parseInt(val);
                  setMatsCount(isNaN(parsed) ? 1 : Math.min(20, Math.max(1, parsed)));
                }
              }} 
              onBlur={() => {
                if (!matsCount || isNaN(matsCount as number) || (matsCount as number) < 1) {
                  setMatsCount(1);
                }
              }}
              min="1" 
              max="20" 
              style={{ marginBottom: 0 }} 
            />
          </div>
          <button 
            type="button" 
            className="btn btn-primary" 
            style={{ height: '44px', padding: '0 24px' }} 
            onClick={() => {
              if (!matsCount || (matsCount as number) < 1) setMatsCount(1);
              toast.success(`Capacity successfully updated to ${matsCount || 1} mats!`);
            }}
          >Apply Capacity</button>
        </div>

        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--neutral-50)', borderRadius: '12px', border: '1px dashed var(--neutral-300)' }}>
          <div className="flex-between mb-4">
            <div>
              <h4 style={{ margin: 0, fontSize: '14px' }}>Scoreboard Logo (Optional)</h4>
              <p className="text-small" style={{ marginTop: '4px' }}>Upload a 1:1 ratio logo to display on all live scoreboards.</p>
            </div>
            {scoreboardLogo && (
              <button type="button" className="btn btn-ghost" onClick={() => setScoreboardLogo(null)} style={{ color: 'var(--aka)' }}>
                <Trash2 size={14} style={{ marginRight: '6px' }}/> Remove
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {scoreboardLogo && (
              <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', background: '#fff', border: '1px solid var(--neutral-200)', flexShrink: 0 }}>
                <img src={scoreboardLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleLogoUpload}
              className="input-field" 
              style={{ flex: 1, padding: '8px', height: 'auto', background: '#fff' }}
            />
          </div>
        </div>
      </div>

      <div className="flex-between mb-4" style={{ marginTop: 'var(--space-4)' }}>
        <div>
          <h3>Mat Security</h3>
          <p className="text-small">Set unique access passwords for each mat score table.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={bulkSetMatPasswords}>
          <Key size={16} /> Bulk Set
        </button>
      </div>
      
      <div className="mat-setup-list">
        {Array.from({ length: Number(matsCount) || 1 }).map((_, i) => (
          <div key={i} className="mat-setup-card">
            <div className="mat-header">
              <div className="mat-number-badge">{i + 1}</div>
              <span className="status-chip" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)' }}>Pending</span>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="text-micro">Scoreboard Access Password</label>
              <div className="password-input-group">
                <input
                  type={showPasswordMap[i] ? "text" : "password"}
                  placeholder="Enter mat password"
                  value={matPasswordMap[i] ?? ''}
                  onChange={e => setMatPasswordMap(prev => ({ ...prev, [i]: e.target.value }))}
                  onBlur={() => {
                    if (matPasswordMap[i]?.trim()) saveMatPassword(i, matPasswordMap[i].trim());
                  }}
                />
                <div className="toggle-password" onClick={() => togglePassword(i)}>
                  {showPasswordMap[i] ? <EyeOff size={16} /> : <Eye size={16} />}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
