'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
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
    // Safety net: if Firebase auth never responds within 5s, unblock the app
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(timeout);
      try {
        setUser(currentUser);

        if (currentUser) {
          // Set session cookie with the Firebase ID token for server-side API validation
          currentUser.getIdToken().then(token => {
            document.cookie = `session=${token}; path=/; max-age=3600; SameSite=Lax; Secure`;
          }).catch(err => {
            console.error('Failed to set session cookie:', err);
          });

          try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
              // Fallback: if role field is missing, treat as 'audience'
              const currentRole = (userDoc.data().role as UserRole) || 'audience';
              setRole(currentRole);

              if (!currentUser.isAnonymous) {
                await setDoc(userDocRef, {
                  email: currentUser.email,
                  displayName: currentUser.displayName || null,
                  photoURL: currentUser.photoURL || null,
                  // Note: 'role' is intentionally NOT written here.
                  // Role is server-authoritative — we read it above but never write it
                  // from the client to prevent privilege escalation.
                  lastLoginAt: new Date().toISOString()
                }, { merge: true });
              }
            } else {
              // New user — only write doc if NOT anonymous
              if (!currentUser.isAnonymous) {
                await setDoc(userDocRef, {
                  email: currentUser.email || null,
                  displayName: currentUser.displayName || null,
                  photoURL: currentUser.photoURL || null,
                  isAnonymous: false,
                  createdAt: new Date().toISOString(),
                  lastLoginAt: new Date().toISOString()
                });
              }
              setRole('audience');
            }
          } catch (error) {
            console.error('Error fetching user role:', error);
            setRole('audience');
          }
        } else {
          setRole(null);
          // Clear session cookie
          document.cookie = `session=; path=/; max-age=0; SameSite=Lax; Secure`;
          
          // Auto sign-in anonymously so viewers can read Firestore collections
          signInAnonymously(auth).catch((err) => console.error("Anonymous auth failed:", err));
        }
      } finally {
        // ALWAYS unblock the app — even if Firebase throws
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        const isStrictAdminRoute = pathname.startsWith('/setup') || pathname.startsWith('/users') || pathname.startsWith('/profile');
        // /operator is intentionally excluded — PasswordGateway handles its own auth for unauthenticated viewers
        const isProtectedCompetitionRoute = pathname.includes('/staff') || pathname.includes('/medals') || pathname.includes('/judge') || pathname.includes('/athletes') || pathname.includes('/records') || pathname.includes('/categories');

        if (isStrictAdminRoute || isProtectedCompetitionRoute) {
          router.push('/login');
        }
        return;
      }

      if (user && role) {
        if (pathname === '/login') {
          if (!user.isAnonymous) {
            router.push('/dashboard');
          }
          return;
        }

        const isAdminOrGuest = role === 'admin' || role === 'guest_viewer';
        const isAdminRoute = pathname.startsWith('/setup') || pathname.startsWith('/users');

        if (isAdminRoute && !isAdminOrGuest) {
          router.push('/competitions');
          return;
        }

        // Removed global portal restrictions because competition pages (like /athletes, /medals) 
        // check their own competition-specific staff subcollections.
      }
    }
  }, [user, role, loading, pathname, router]);

  const ctxValue = useMemo(
    () => ({ user, role, loading }),
    [user, role, loading]
  );

  return (
    <AuthContext.Provider value={ctxValue}>
      {/* Always render children — pages handle their own auth-aware loading states */}
      {children}
    </AuthContext.Provider>
  );
}
