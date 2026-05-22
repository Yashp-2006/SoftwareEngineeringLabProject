'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { auth } from '@lib/firebase';
import { signOut } from 'firebase/auth';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role, loading } = useAuth();

  if (pathname.startsWith('/login')) {
    return null;
  }

  if (loading) return null;

  return (
    <nav>
      <div className="nav-logo">TAIKAIX</div>
      
      <div className="nav-links">
        {(role === 'admin' || role === 'guest_viewer') && (
          <>
            <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
              Dashboard
            </Link>
            <Link href="/users" className={`nav-link ${pathname.startsWith('/users') ? 'active' : ''}`}>
              Users
            </Link>
          </>
        )}
        <Link href="/competitions" className={`nav-link ${pathname.startsWith('/competitions') ? 'active' : ''}`}>
          Competitions
        </Link>
      </div>

      <div className="nav-profile">
        {user ? (
          <>
            <Link 
              href="/profile"
              className="avatar" 
              style={{ border: '2px solid transparent', transition: 'border-color 0.2s', padding: 0, background: 'var(--neutral-200)', color: 'var(--neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', textDecoration: 'none' }}
              title="Go to Profile"
            >
              {(user.email || '?').charAt(0).toUpperCase()}
            </Link>
          </>
        ) : (
          <Link href="/login" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '14px', textDecoration: 'none' }}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
