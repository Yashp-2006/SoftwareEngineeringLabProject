'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

export type UserRole = 'admin' | 'guest_viewer' | 'attendance_volunteer' | 'mat_operator' | 'medal_distributor' | 'judge' | 'audience' | null;

interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const currentRole = userDoc.data().role;
            setRole(currentRole as UserRole);

            await setDoc(userDocRef, {
              email: currentUser.email,
              displayName: currentUser.displayName || null,
              photoURL: currentUser.photoURL || null,
              // Note: 'role' is intentionally NOT written here.
              // Role is server-authoritative — we read it above but never write it
              // from the client to prevent privilege escalation.
              lastLoginAt: new Date().toISOString()
            }, { merge: true });
          } else {
            // eslint-disable-next-line react-doctor/firebase-client-owned-authz-field
            await setDoc(userDocRef, {
              email: currentUser.email,
              displayName: currentUser.displayName || null,
              photoURL: currentUser.photoURL || null,
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            });
            setRole('audience');
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole('audience');
        }
      } else {
        setRole(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        const isStrictAdminRoute = pathname === '/' || pathname.startsWith('/setup') || pathname.startsWith('/users') || pathname.startsWith('/profile');
        const isProtectedCompetitionRoute = pathname.includes('/staff') || pathname.includes('/medals') || pathname.includes('/judge') || pathname.includes('/operator') || pathname.includes('/athletes') || pathname.includes('/records') || pathname.includes('/categories');
        
        if (isStrictAdminRoute || isProtectedCompetitionRoute) {
          if (pathname === '/') {
            router.push('/competitions');
          } else {
            router.push('/login');
          }
        }
        return;
      }

      if (user && role) {
        if (pathname === '/login') {
          router.push('/');
          return;
        }

        const isAdminOrGuest = role === 'admin' || role === 'guest_viewer';
        const isAdminRoute = pathname === '/' || pathname.startsWith('/setup') || pathname.startsWith('/users');
        
        if (isAdminRoute && !isAdminOrGuest) {
          router.push('/competitions');
          return;
        }

        // Restrict Specific Portals
        if (pathname.includes('/operator') && role !== 'mat_operator' && !isAdminOrGuest) {
          router.push('/competitions');
        }
        if (pathname.includes('/judge') && role !== 'judge' && !isAdminOrGuest) {
          router.push('/competitions');
        }
        if (pathname.includes('/staff') && !isAdminOrGuest) {
          router.push('/competitions');
        }
        if (pathname.includes('/records') && !isAdminOrGuest) {
          router.push('/competitions');
        }
        if (pathname.includes('/categories') && !isAdminOrGuest) {
          router.push('/competitions');
        }
        if (pathname.includes('/medals') && role !== 'medal_distributor' && !isAdminOrGuest) {
          router.push('/competitions');
        }
        if (pathname.includes('/athletes') && role !== 'attendance_volunteer' && !isAdminOrGuest) {
          router.push('/competitions');
        }
      }
    }
  }, [user, role, loading, pathname, router]);

  const ctxValue = useMemo(
    () => ({ user, role, loading }),
    [user, role, loading]
  );

  return (
    <AuthContext.Provider value={ctxValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
