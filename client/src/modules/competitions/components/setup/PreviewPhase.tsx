import React from 'react';
import { Combine, RefreshCw, Eye, Download } from 'lucide-react';

interface PreviewPhaseProps {
  poolSize: number;
  importResult: any;
  categories: any[];
  setUndersizedModalOpen: (val: boolean) => void;
  handleRegenerateTiesheets: () => void;
  regeneratingTiesheets: boolean;
  setPreviewCatId: (val: string | null) => void;
  setPreviewModalOpen: (val: boolean) => void;
  handleDownloadTiesheets: () => void;
  downloadingTiesheets: boolean;
}

export default function PreviewPhase({
  poolSize, importResult, categories, setUndersizedModalOpen,
  handleRegenerateTiesheets, regeneratingTiesheets,
  setPreviewCatId, setPreviewModalOpen,
  handleDownloadTiesheets, downloadingTiesheets
}: PreviewPhaseProps) {
  return (
    <div className="cat-group">
      <p className="text-small">Pool size: {poolSize} (configured in Phase 2)</p>
      {!importResult && categories.length === 0 ? (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--neutral-50)', borderRadius: '12px', border: '1px dashed var(--neutral-300)' }}>
          <p style={{ color: 'var(--neutral-500)' }}>No categories defined yet. Please upload an Excel file in Phase 1 or create categories manually.</p>
        </div>
      ) : (
        <div className="mat-setup-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', padding: 'var(--space-4)' }}>
          <div style={{ flex: '1 1 200px' }}>
            <h4 style={{ margin: '0 0 4px 0' }}>{importResult ? importResult.categoriesTotal : categories.length} Categories Generated</h4>
            <p className="text-small" style={{ color: 'var(--neutral-500)', margin: 0 }}>
              {importResult ? importResult.athletesImported : 'N/A'} Athletes {importResult ? 'Imported' : ''} • Pool size: {poolSize}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button"
                className="btn btn-secondary"
                onClick={() => setUndersizedModalOpen(true)}
                disabled={!importResult && categories.length === 0}
              >
                <Combine size={16} style={{ marginRight: '6px' }} />
                Manage Undersized Pools
              </button>
              <button type="button"
                className="btn btn-secondary"
                style={{ color: 'var(--aka)', borderColor: 'var(--aka)' }}
                onClick={handleRegenerateTiesheets}
                disabled={regeneratingTiesheets || (!importResult && categories.length === 0)}
                title="Re-run bracket generation for all categories. Use this if tiesheets didn't load correctly."
              >
                <RefreshCw size={16} style={{ marginRight: '6px' }} />
                {regeneratingTiesheets ? 'Regenerating...' : 'Regenerate Tiesheets'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button"
                className="btn btn-primary"
                onClick={() => { setPreviewCatId(null); setPreviewModalOpen(true); }}
              >
                <Eye size={16} style={{ marginRight: '8px' }} />
                Preview Tiesheets
              </button>
              <button type="button"
                className="btn btn-secondary"
                onClick={handleDownloadTiesheets}
                disabled={downloadingTiesheets || (!importResult && categories.length === 0)}
              >
                <Download size={16} style={{ marginRight: '6px' }} />
                {downloadingTiesheets ? 'Generating...' : 'Download Tiesheets'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
