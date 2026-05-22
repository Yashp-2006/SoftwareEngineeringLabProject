'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

export type UserRole = 'admin' | 'guest_viewer' | 'attendance_volunteer' | 'mat_operator' | 'medal_distributor' | 'audience' | null;

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
            // Upgrade audience to admin for developer convenience
            const currentRole = userDoc.data().role;
            const assignedRole = currentRole === 'audience' ? 'admin' : currentRole;
            setRole(assignedRole as UserRole);

            // Update latest user info
            await setDoc(userDocRef, {
              email: currentUser.email,
              displayName: currentUser.displayName || null,
              photoURL: currentUser.photoURL || null,
              role: assignedRole,
              lastLoginAt: new Date().toISOString()
            }, { merge: true });
          } else {
            // First time login - default to admin
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || null,
              photoURL: currentUser.photoURL || null,
              role: 'admin',
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            });
            setRole('admin');
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole('audience'); // Fallback safely
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
      // 1. Unauthenticated Users
      if (!user) {
        const isStrictAdminRoute = pathname === '/' || pathname.startsWith('/setup') || pathname.startsWith('/users') || pathname.startsWith('/profile');
        const isPortalRoute = pathname.includes('/operator') || pathname.includes('/staff') || pathname.includes('/medals');
        
        if (isStrictAdminRoute || isPortalRoute) {
          if (pathname === '/') {
            router.push('/competitions');
          } else {
            router.push('/login');
          }
        }
        return; // Exit early
      }

      // 2. Authenticated Users routing logic based on Role
      if (user && role) {
        // Prevent going to login if already logged in
        if (pathname === '/login') {
          if (role === 'admin' || role === 'guest_viewer') router.push('/');
          else router.push('/competitions');
          return;
        }

        // Restrict Admin-only routes
        const isAdminRoute = pathname === '/' || pathname.startsWith('/setup') || pathname.startsWith('/users');
        if (isAdminRoute && role !== 'admin' && role !== 'guest_viewer') {
          router.push('/competitions'); // Kick non-admins out to public directory
          return;
        }

        // Restrict Specific Portals
        if (pathname.includes('/operator') && role !== 'mat_operator' && role !== 'admin' && role !== 'guest_viewer') {
          router.push('/competitions');
        }
        if (pathname.includes('/staff') && role !== 'attendance_volunteer' && role !== 'admin' && role !== 'guest_viewer') {
          router.push('/competitions');
        }
        if (pathname.includes('/medals') && role !== 'medal_distributor' && role !== 'admin' && role !== 'guest_viewer') {
          router.push('/competitions');
        }
      }
    }
  }, [user, role, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
