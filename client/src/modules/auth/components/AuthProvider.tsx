'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import type { UserRole } from '@taikaix/backend/types';
import { getNormalizedRole } from '@/modules/auth/rbac';
export type { UserRole };

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

    let unsubUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(timeout);
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      try {
        if (currentUser?.isAnonymous) {
          // Immediately purge legacy anonymous session so it never persists or shows in console
          try {
            await currentUser.delete();
          } catch {
            await signOut(auth);
          }
          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        setUser(currentUser);

        if (currentUser) {
          // Set session cookie with the Firebase ID token for server-side API validation
          currentUser.getIdToken().then(token => {
            document.cookie = `session=${token}; path=/; max-age=3600; SameSite=Lax; Secure`;
          }).catch(err => {
            console.error('Failed to set session cookie:', err);
          });

          const userDocRef = doc(db, 'users', currentUser.uid);
          const deletedDocRef = doc(db, 'deleted_users', currentUser.uid);
          let isInitialCheck = true;

          const evictSession = async () => {
            try {
              document.cookie = `session=; path=/; max-age=0; SameSite=Lax; Secure`;
              sessionStorage.clear();
              setUser(null);
              setRole(null);
              setLoading(false);
              await currentUser.delete().catch(() => {});
              await signOut(auth).catch(() => {});
            } catch (e) {
              console.error('Failed to evict deleted user session', e);
            } finally {
              window.location.href = '/login';
            }
          };

          unsubUserDoc = onSnapshot(userDocRef, async (snap) => {
            try {
              if (snap.exists()) {
                const data = snap.data();
                if (data.deleted === true || data.status === 'deleted') {
                  // User was marked deleted by admin! Evict all active devices/screens immediately.
                  await evictSession();
                  return;
                }

                const currentRole = getNormalizedRole(data.role as string | null | undefined);
                setRole(currentRole);
                setLoading(false);

                if (isInitialCheck) {
                  isInitialCheck = false;
                  await setDoc(userDocRef, {
                    email: currentUser.email,
                    displayName: currentUser.displayName || null,
                    photoURL: currentUser.photoURL || null,
                    lastLoginAt: new Date().toISOString()
                  }, { merge: true }).catch(() => {});
                }
              } else {
                // Document does not exist in users collection.
                // 1. Check if user is in deleted_users tombstone collection
                const delSnap = await getDoc(deletedDocRef).catch(() => null);
                if (delSnap && delSnap.exists()) {
                  await evictSession();
                  return;
                }

                // 2. If it was already loaded previously and now doc is missing, admin deleted it!
                if (!isInitialCheck) {
                  await evictSession();
                  return;
                }

                // 3. If very first check: is it a brand new registration?
                const isRecentlyCreated = currentUser.metadata.creationTime &&
                  (Date.now() - new Date(currentUser.metadata.creationTime).getTime() < 120000);

                if (isRecentlyCreated) {
                  isInitialCheck = false;
                  await setDoc(userDocRef, {
                    email: currentUser.email || null,
                    displayName: currentUser.displayName || null,
                    photoURL: currentUser.photoURL || null,
                    role: 'viewer',
                    isAnonymous: false,
                    createdAt: new Date().toISOString(),
                    lastLoginAt: new Date().toISOString()
                  }).catch(() => {});
                  setRole('viewer');
                  setLoading(false);
                } else {
                  // Existing account with no Firestore doc (deleted by admin) -> evict immediately
                  await evictSession();
                }
              }
            } catch (err) {
              console.error('[AuthProvider] Error in user snapshot listener:', err);
              setLoading(false);
            }
          }, (err) => {
            console.error('[AuthProvider] Snapshot listener error:', err);
            setLoading(false);
          });
        } else {
          setRole(null);
          // Clear session cookie
          document.cookie = `session=; path=/; max-age=0; SameSite=Lax; Secure`;
          setLoading(false);
        }
      } catch (err) {
        console.error('[AuthProvider] Auth state change error:', err);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        const isStrictAdminRoute = pathname.startsWith('/setup') || pathname.startsWith('/users') || pathname.startsWith('/profile');
        // /operator and /medals excluded — they have their own password/role gates
        // /judge is protected — audience cannot vote
        const isProtectedCompetitionRoute = pathname.includes('/staff') || pathname.includes('/judge') || pathname.includes('/athletes') || pathname.includes('/records') || pathname.includes('/categories');

        if (isStrictAdminRoute || isProtectedCompetitionRoute) {
          router.push('/login');
        }
        return;
      }

      if (user && role) {
        if (pathname === '/login') {
          // audience users have no dashboard — send them to competitions directory
          const destination = (role === 'admin' || role === 'guest_viewer') ? '/dashboard' : '/competitions';
          router.push(destination);
          return;
        }

        const isAdminOrGuest = role === 'admin' || role === 'guest_viewer';
        const isAdminRoute = pathname.startsWith('/setup') || pathname.startsWith('/users');

        if (isAdminRoute && !isAdminOrGuest) {
          router.push('/competitions');
          return;
        }

        // Block audience/viewer from judge page (they can't vote)
        if (pathname.includes('/judge') && (role === 'viewer' || (role as string) === 'audience')) {
          router.push(`/competitions/${pathname.split('/')[2]}`);
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
