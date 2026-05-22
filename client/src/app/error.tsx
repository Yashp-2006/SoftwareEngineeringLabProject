'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2 style={{ color: 'red' }}>Something went wrong!</h2>
      <p style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', color: '#333' }}>
        {error.message}
      </p>
      <button 
        onClick={() => reset()}
        style={{ marginTop: '20px', padding: '10px 20px', background: 'black', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  );
}
