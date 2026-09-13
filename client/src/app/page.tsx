'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/modules/auth/components/AuthProvider';

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user && !user.isAnonymous) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--shiro, #FFFFFF)',
      fontFamily: 'var(--font-display, inherit)',
      color: 'var(--neutral-500, #666)',
      fontSize: '16px',
      letterSpacing: '0.05em'
    }}>
      Loading...
    </div>
  );
}
