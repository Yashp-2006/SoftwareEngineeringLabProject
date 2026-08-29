'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { Menu, X, ChevronDown } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [mobileMenuOpen]);

  // Close profile dropdown on outside click or Escape
  useEffect(() => {
    if (!profileOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [profileOpen]);

  const handleSignOut = async () => {
    setProfileOpen(false);
    const { auth } = await import('@lib/firebase');
    await auth.signOut();
    window.location.href = '/';
  };

  if (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/live')) {
    return null;
  }

  return (
    <div ref={menuRef} style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      <nav style={{ position: 'relative', zIndex: 100 }}>
        {user && !user.isAnonymous ? (
          <Link href="/dashboard" className="nav-logo" style={{ textDecoration: 'none' }}>TAIKAIX</Link>
        ) : (
          <Link href="/" className="nav-logo" style={{ textDecoration: 'none' }}>TAIKAIX</Link>
        )}

        <div className="nav-links hide-on-mobile">
          {(!loading && (role === 'admin' || role === 'guest_viewer')) && (
            <Link href="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}>
              Dashboard
            </Link>
          )}
          <Link
            href="/competitions"
            className={`nav-link ${
              pathname.startsWith('/competitions') ||
              pathname.startsWith('/setup') ||
              pathname.startsWith('/live') ||
              pathname.startsWith('/archives')
                ? 'active'
                : ''
            }`}
          >
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
            <div className="avatar" style={{ background: 'var(--neutral-300)' }} />
          ) : user && !user.isAnonymous ? (
            <div ref={profileRef} style={{ position: 'relative' }}>
              {/* Trigger */}
              <button
                onClick={() => setProfileOpen(o => !o)}
                aria-expanded={profileOpen}
                aria-haspopup="true"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                  borderRadius: '8px',
                }}
              >
                <div
                  className="avatar"
                  style={{
                    border: '2px solid transparent',
                    background: user?.photoURL
                      ? `url(${user.photoURL}) center/cover`
                      : `var(--neutral-200) url('https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'Felix'}') center/cover`,
                  }}
                />
                <ChevronDown
                  size={14}
                  style={{
                    color: 'var(--neutral-500)',
                    transition: 'transform 180ms var(--ease-out)',
                    transform: profileOpen ? 'rotate(180deg)' : 'none',
                  }}
                />
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  minWidth: '180px',
                  background: 'var(--shiro)',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                  overflow: 'hidden',
                  zIndex: 200,
                  animation: 'profileDropIn 160ms var(--ease-out) both',
                }}>
                  {/* User info header */}
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--neutral-100)',
                  }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 700, color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.displayName || 'User'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--neutral-400)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </div>
                  </div>

                  {/* Menu items */}
                  <div style={{ padding: '4px' }}>
                    <Link
                      href="/profile"
                      onClick={() => setProfileOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 12px', borderRadius: '6px',
                        fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600,
                        color: 'var(--neutral-700)', textDecoration: 'none',
                        transition: 'background 120ms',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--neutral-100)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      Edit Profile
                    </Link>

                    <button
                      onClick={handleSignOut}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        width: '100%', padding: '9px 12px', borderRadius: '6px',
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600,
                        color: 'var(--aka)', textAlign: 'left',
                        transition: 'background 120ms',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--aka-light)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Hamburger — only shown on mobile */}
        <button
          className="show-on-mobile"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: 'var(--shiro)',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            minWidth: '44px',
            borderRadius: '6px',
            transition: 'background 0.2s',
          }}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile Dropdown — z-index 200 sits above sub-nav (99) and nav (100) */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 'var(--nav-height-mobile)',
            left: 0,
            right: 0,
            background: 'rgba(13, 13, 13, 0.97)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: 'var(--space-4)',
            zIndex: 200,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'slideDown 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <style>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {(!loading && (role === 'admin' || role === 'guest_viewer')) && (
            <Link
              href="/dashboard"
              className="nav-link"
              style={{ padding: '10px 12px', borderRadius: '8px', height: 'auto', minHeight: '44px' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
          )}
          <Link
            href="/competitions"
            className="nav-link"
            style={{ padding: '10px 12px', borderRadius: '8px', height: 'auto', minHeight: '44px' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            Competitions
          </Link>
          {(role === 'admin' || role === 'guest_viewer') && (
            <Link
              href="/users"
              className="nav-link"
              style={{ padding: '10px 12px', borderRadius: '8px', height: 'auto', minHeight: '44px' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Users
            </Link>
          )}

          <div
            style={{
              height: '1px',
              background: 'rgba(255,255,255,0.08)',
              margin: 'var(--space-2) 0',
            }}
          />

          {user && !user.isAnonymous ? (
            <Link
              href="/profile"
              className="nav-link"
              style={{ padding: '10px 12px', borderRadius: '8px', height: 'auto', minHeight: '44px' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Profile ({(user.email || '').split('@')[0]})
            </Link>
          ) : (
            <Link
              href="/login"
              className="btn btn-primary"
              style={{ justifyContent: 'center', margin: '4px 0' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
