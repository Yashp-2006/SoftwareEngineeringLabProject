'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

export default function CompetitionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const pathname = usePathname();

  const router = useRouter();
  const { role, user, loading: authLoading } = useAuth();
  const { id } = React.use(params);

  const isActive = (segment: string) => pathname.includes(segment);
  const isRoot = pathname === `/competitions/${id}`;

  // Redirect unauthenticated viewers trying to access sub-pages directly
  // The overview page handles the password gate itself; sub-pages redirect back to it
  useEffect(() => {
    if (authLoading) return;
    if (user) return; // signed-in users are always allowed

    const isJoined = typeof window !== 'undefined' && localStorage.getItem(`joined_${id}`) === 'true';
    const searchParams = new URLSearchParams(window.location.search);
    const hasJoinParam = searchParams.get('join') === 'true';

    if (hasJoinParam) {
      // Store the join token
      if (typeof window !== 'undefined') {
        localStorage.setItem(`joined_${id}`, 'true');
      }
      return;
    }

    // If on a sub-page (not overview) and not authenticated, redirect to overview
    if (!isRoot && !isJoined) {
      router.replace(`/competitions/${id}`);
    }
  }, [authLoading, user, id, isRoot, router]);

  // Role-based visibility — requires active sign-in for staff tabs
  const isAdmin = role === 'admin';
  const isAdminOrGuest = role === 'admin' || role === 'guest_viewer';
  const showCategories = isAdminOrGuest;
  const showStaff = isAdminOrGuest;
  const showAthletes = isAdminOrGuest || role === 'attendance_volunteer';
  const showRecords = isAdminOrGuest;
  const showMedals = isAdminOrGuest || role === 'medal_distributor';
  const showOperator = isAdminOrGuest || role === 'mat_operator';
  // Judge tab only visible for signed-in users with judge or admin/guest_viewer role (removed per request)
  const showJudge = false;

  const linkStyle = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' };

  const joinParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('join') === 'true' ? '?join=true' : '';

  return (
    <>
      <div className="sub-nav">
        <Link
          href={`/competitions/${id}${joinParam}`}
          className={`sub-nav-link ${isRoot ? 'active' : ''}`}
        >
          Overview
        </Link>
        {showJudge && (
          <Link
            href={`/competitions/${id}/judge${joinParam}`}
            className={`sub-nav-link ${isActive('/judge') ? 'active' : ''}`}
          >
            Judge
          </Link>
        )}
        {showCategories && (
          <Link
            href={`/competitions/${id}/categories${joinParam}`}
            className={`sub-nav-link ${isActive('/categories') ? 'active' : ''}`}
          >
            Categories
          </Link>
        )}
        <Link
          href={`/competitions/${id}/bracket${joinParam}`}
          className={`sub-nav-link ${isActive('/bracket') ? 'active' : ''}`}
        >
          Tiesheet
        </Link>
        <Link
          href={`/competitions/${id}/mats${joinParam}`}
          className={`sub-nav-link ${isActive('/mats') ? 'active' : ''}`}
        >
          Mats
        </Link>

        {showStaff && (
          <Link
            href={`/competitions/${id}/staff${joinParam}`}
            className={`sub-nav-link ${isActive('/staff') ? 'active' : ''}`}
          >
            Staff
          </Link>
        )}

        {showAthletes && (
          <Link
            href={`/competitions/${id}/athletes${joinParam}`}
            className={`sub-nav-link ${isActive('/athletes') ? 'active' : ''}`}
          >
            Athletes
          </Link>
        )}

        {showRecords && (
          <Link
            href={`/competitions/${id}/records${joinParam}`}
            className={`sub-nav-link ${isActive('/records') ? 'active' : ''}`}
          >
            Records
          </Link>
        )}

        {showMedals && (
          <Link
            href={`/competitions/${id}/medals${joinParam}`}
            className={`sub-nav-link ${isActive('/medals') ? 'active' : ''}`}
          >
            Medals
          </Link>
        )}

        <Link
          href={`/competitions/${id}/schedule${joinParam}`}
          className={`sub-nav-link ${isActive('/schedule') ? 'active' : ''}`}
        >
          Schedule
        </Link>

        {showOperator && (
          <Link
            href={`/competitions/${id}/operator${joinParam}`}
            className={`sub-nav-link ${isActive('/operator') ? 'active' : ''}`}
            style={{ marginLeft: 'auto', color: isActive('/operator') ? 'var(--aka)' : 'var(--neutral-500)', fontWeight: 600 }}
          >
            ● Mat Operations
          </Link>
        )}
      </div>

      {children}
    </>
  );
}
