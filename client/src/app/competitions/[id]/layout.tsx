'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

export default function CompetitionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const { id } = React.use(params);

  const isActive = (segment: string) => pathname.includes(segment);
  const isRoot = pathname === `/competitions/${id}`;

  // Role-based visibility
  const isAdminOrGuest = role === 'admin' || role === 'guest_viewer';
  const showCategories = isAdminOrGuest;
  const showStaff = true;
  const showAthletes = isAdminOrGuest || role === 'attendance_volunteer';
  const showMedals = isAdminOrGuest || role === 'medal_distributor';
  const showOperator = role === 'admin' || role === 'mat_operator';

  const linkStyle = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' };

  const joinParam = searchParams.get('join') === 'true' ? '?join=true' : '';

  return (
    <>
      <div className="sub-nav">
        <Link
          href={`/competitions/${id}${joinParam}`}
          className={`sub-nav-link ${isRoot ? 'active' : ''}`}
        >
          Overview
        </Link>
        <Link
          href={`/competitions/${id}/judge${joinParam}`}
          className={`sub-nav-link ${isActive('/judge') ? 'active' : ''}`}
        >
          Judge
        </Link>
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
