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
  const menuRef = useRef<HTMLDivElement>(null);

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
            <>
              <Link
                href="/profile"
                className="avatar"
                style={{
                  border: '2px solid transparent',
                  transition: 'border-color 0.2s',
                  background: user?.photoURL
                    ? `url(${user.photoURL}) center/cover`
                    : `var(--neutral-200) url('https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'Felix'}') center/cover`,
                }}
                title="Go to Profile"
              />
              <ChevronDown size={16} style={{ color: 'var(--neutral-500)' }} />
            </>
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
