import React from 'react';
import { Save, CheckCircle } from 'lucide-react';

interface HeaderProps {
  breadcrumbs: string;
  title: string;
  showSetupActions?: boolean;
}

export default function Header({ breadcrumbs, title, showSetupActions }: HeaderProps) {
  return (
    <header className="page-header">
      <div>
        <div className="breadcrumb">{breadcrumbs}</div>
        <h1>{title}</h1>
      </div>
      {showSetupActions && (
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary">
            <Save style={{ width: '18px' }} /> Save Draft
          </button>
          <button className="btn btn-primary">
            <CheckCircle style={{ width: '18px' }} /> Finalize Setup
          </button>
        </div>
      )}
    </header>
  );
}
