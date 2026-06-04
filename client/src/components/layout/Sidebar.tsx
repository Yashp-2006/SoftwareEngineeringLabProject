'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Menu, X, ChevronDown } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname.startsWith('/login') || pathname.startsWith('/live')) {
    return null;
  }

  return (
    <>
      <nav>
        <div className="nav-logo">TAIKAIX</div>
        
        <div className="nav-links hide-on-mobile">
          {(!loading && (role === 'admin' || role === 'guest_viewer')) && (
            <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
              Dashboard
            </Link>
          )}
          <Link href="/competitions" className={`nav-link ${pathname.startsWith('/competitions') || pathname.startsWith('/setup') || pathname.startsWith('/live') || pathname.startsWith('/archives') ? 'active' : ''}`}>
            Competitions
          </Link>
          {(!loading && (role === 'admin' || role === 'guest_viewer')) && (
            <Link href="/users" className={`nav-link ${pathname.startsWith('/users') ? 'active' : ''}`}>
              Users
            </Link>
          )}
        </div>

        <div className="nav-profile hide-on-mobile">
          {loading ? (
             <div className="avatar" style={{ background: 'var(--neutral-300)' }}></div>
          ) : user ? (
            <>
              <Link
                href="/profile"
                className="avatar"
                style={{
                  border: '2px solid transparent',
                  transition: 'border-color 0.2s',
                  background: user?.photoURL ? `url(${user.photoURL}) center/cover` : `var(--neutral-200) url('https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'Felix'}') center/cover`,
                }}
                title="Go to Profile"
              />
              <ChevronDown size={16} style={{ color: 'var(--neutral-500)' }} />
            </>
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
        <div
          className="show-on-mobile"
          style={{
            position: 'fixed',
            top: '56px',
            left: 0,
            right: 0,
            background: 'var(--kuro)',
            padding: 'var(--space-4)',
            zIndex: 99,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          {(!loading && (role === 'admin' || role === 'guest_viewer')) && (
            <Link href="/" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
          )}
          <Link href="/competitions" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Competitions</Link>
          {(role === 'admin' || role === 'guest_viewer') && (
            <Link href="/users" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Users</Link>
          )}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: 'var(--space-2) 0' }} />
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
