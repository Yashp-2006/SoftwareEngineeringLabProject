'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/modules/auth/components/AuthProvider';

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
  const [staffRole, setStaffRole] = useState<string | null>(null);

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

  useEffect(() => {
    if (!user) {
      setStaffRole(null);
      return;
    }
    const fetchStaffRole = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        // Check by userId first (set by PIN auth and approved email login)
        let snap = await getDocs(query(
          collection(db, 'competitions', id, 'staff'),
          where('userId', '==', user.uid),
          where('approvalStatus', '==', 'approved')
        ));
        // Fallback to requestUserId (set during enrollment requests)
        if (snap.empty) {
          snap = await getDocs(query(
            collection(db, 'competitions', id, 'staff'),
            where('requestUserId', '==', user.uid),
            where('approvalStatus', '==', 'approved')
          ));
        }
        // Fallback to direct email match if user logged in via email
        if (snap.empty && user.email) {
          snap = await getDocs(query(
            collection(db, 'competitions', id, 'staff'),
            where('email', '==', user.email),
            where('approvalStatus', '==', 'approved')
          ));
        }

        if (!snap.empty) {
          setStaffRole(snap.docs[0].data().role);
        } else {
          setStaffRole(null);
        }
      } catch (e) {
        console.error('Error fetching staff role:', e);
      }
    };
    fetchStaffRole();
  }, [user, id]);

  // Role-based visibility — requires active sign-in for staff tabs
  const isAdmin = role === 'admin';
  const isAdminOrGuest = role === 'admin' || role === 'guest_viewer';
  const showCategories = isAdminOrGuest;
  const showStaff = isAdminOrGuest;
  const showAthletes = isAdminOrGuest || role === 'attendance_volunteer' || staffRole === 'attendance';
  const showRecords = isAdminOrGuest;
  // Medals: only visible to admin, guest_viewer, or medal_distributor staff
  const showMedals = isAdminOrGuest || role === 'medal_distributor' || staffRole === 'medal';
  const showOperator = isAdminOrGuest || role === 'mat_operator' || staffRole === 'score';
  // Judge tab: visible to judges (by global role or staff assignment) and admins/guest_viewers
  const showJudge = isAdminOrGuest || role === 'judge' || staffRole === 'judge';

  const linkStyle = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' };

  const joinParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('join') === 'true' ? '?join=true' : '';

  if (pathname.includes('/scoreboard')) {
    return <>{children}</>;
  }

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
          className={`sub-nav-link ${isActive('/mats') || isActive('/operator') ? 'active' : ''}`}
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
      </div>

      {children}
    </>
  );
}
