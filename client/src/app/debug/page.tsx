'use client';

import React from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { redirect } from 'next/navigation';

export default function DebugPage() {
  if (process.env.NODE_ENV === 'production') {
    redirect('/');
  }
  const { user, role, loading } = useAuth();

  return (
    <div style={{ padding: '40px', background: 'white', color: 'black' }}>
      <h1>Debug Information</h1>
      <pre>
        {JSON.stringify({
          loading,
          role,
          user: user ? {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
          } : null
        }, null, 2)}
      </pre>
    </div>
  );
}
