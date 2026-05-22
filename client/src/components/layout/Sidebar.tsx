'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Menu, X } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname.startsWith('/login')) {
    return null;
  }

  if (loading) return null;

  return (
    <>
      <nav>
        <div className="nav-logo">TAIKAIX</div>
        
        <div className="nav-links hide-on-mobile">
          <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
            Dashboard ({role || 'none'})
          </Link>
          <Link href="/users" className={`nav-link ${pathname.startsWith('/users') ? 'active' : ''}`}>
            Users
          </Link>
          <Link href="/competitions" className={`nav-link ${pathname.startsWith('/competitions') ? 'active' : ''}`}>
            Competitions
          </Link>
        </div>

        <div className="nav-profile hide-on-mobile">
          {user ? (
            <Link 
              href="/profile"
              className="avatar" 
              style={{ border: '2px solid transparent', transition: 'border-color 0.2s', padding: 0, background: 'var(--neutral-200)', color: 'var(--neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', textDecoration: 'none' }}
              title="Go to Profile"
            >
              {(user.email || '?').charAt(0).toUpperCase()}
            </Link>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '14px', textDecoration: 'none' }}>
              Sign In
            </Link>
          )}
        </div>

        <div className="show-on-mobile" style={{ marginLeft: 'auto' }}>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ background: 'transparent', border: 'none', color: 'var(--shiro)', cursor: 'pointer', padding: '8px' }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-menu show-on-mobile" style={{
          position: 'fixed',
          top: '56px',
          left: 0,
          right: 0,
          background: 'var(--kuro)',
          padding: 'var(--space-4)',
          zIndex: 99,
          borderBottom: '1px solid var(--neutral-700)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)'
        }}>
          <Link href="/" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Dashboard ({role || 'none'})</Link>
          <Link href="/users" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Users</Link>
          <Link href="/competitions" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Competitions</Link>
          
          <div style={{ height: '1px', background: 'var(--neutral-700)', margin: 'var(--space-2) 0' }} />
          
          {user ? (
            <Link href="/profile" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              Profile ({(user.email || '').split('@')[0]})
            </Link>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ textAlign: 'center' }} onClick={() => setMobileMenuOpen(false)}>
              Sign In
            </Link>
          )}
        </div>
      )}
    </>
  );
}
