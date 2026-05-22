'use client';
import React from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';

export default function AttendancePortal() {
  return (
    <main className="container">
      <Header breadcrumbs="TaiKaiX / Attendance" title="Athlete Check-In" />
      <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-8)', textAlign: 'center', background: 'var(--shiro)', borderRadius: '16px', border: '1px solid var(--neutral-200)' }}>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Attendance Volunteer Portal</h2>
        <p className="text-small" style={{ marginBottom: 'var(--space-4)' }}>Update attendance, mark athletes ready or not ready, and issue disqualifications.</p>
        <Link href="/competitions" className="btn btn-primary" style={{ textDecoration: 'none' }}>Go to Directory</Link>
      </div>
    </main>
  );
}
