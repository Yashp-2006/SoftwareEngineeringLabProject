'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, Trophy, Activity, Users } from 'lucide-react';
import { useAuth } from '@/modules/auth/components/AuthProvider';

export default function LandingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentInvites, setRecentInvites] = useState<{ id: string; name: string; date: number }[]>([]);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('taikaix_recent_invites');
      if (stored) setRecentInvites(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    if (!authLoading && user && !user.isAnonymous) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (searchQuery.length >= 20) {
      router.push(`/competitions/${searchQuery}`);
    } else {
      router.push(`/competitions?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const removeInvite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = recentInvites.filter(inv => inv.id !== id);
    setRecentInvites(updated);
    localStorage.setItem('taikaix_recent_invites', JSON.stringify(updated));
  };

  const features = [
    { icon: <Trophy size={28} strokeWidth={1.5} />, title: 'Live Brackets', desc: 'Real-time advancement and tie-breakers. Automatic syncing across all officials.', accent: 'var(--aka)' },
    { icon: <Activity size={28} strokeWidth={1.5} />, title: 'Mat Queues', desc: 'Digital scoreboards and dynamic scheduling. Eliminate paper brackets entirely.', accent: 'var(--ao)' },
    { icon: <Users size={28} strokeWidth={1.5} />, title: 'Athlete Portal', desc: 'Self-service check-in. Competitors track their exact match time live.', accent: 'var(--kuro)' },
  ];

  return (
    <>
      <style>{`
        /* Core Physics & Custom Easings (Emil-Design-Eng) */
        :root {
          --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
          --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
        }

        /* Ambient Premium Background */
        .ambient-bg {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #FAFAFA;
          overflow: hidden;
          z-index: -1;
        }
        .ambient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.15;
          animation: orb-float 24s infinite alternate ease-in-out;
        }
        .orb-red {
          background: var(--aka);
          width: 50vw; height: 50vw;
          top: -10%; right: -10%;
        }
        .orb-blue {
          background: var(--ao);
          width: 60vw; height: 60vw;
          bottom: -20%; left: -20%;
          animation-delay: -12s;
        }

        @keyframes orb-float {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-5%, 5%) scale(1.1); }
        }

        /* Glassmorphism Utilities */
        .glass-pill {
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
        }

        /* Nav */
        .premium-nav {
          position: sticky;
          top: 24px;
          margin: 0 auto;
          width: calc(100% - 48px);
          max-width: 1200px;
          height: 64px;
          border-radius: 32px;
          display: flex;
          align-items: center;
          padding: 0 24px;
          z-index: 100;
          transition: transform 0.3s;
        }

        /* Hero Typography */
        .hero-title {
          font-family: var(--font-display);
          font-size: clamp(64px, 12vw, 130px);
          line-height: 0.85;
          color: var(--kuro);
          text-transform: uppercase;
          letter-spacing: 0.01em;
          text-wrap: balance;
        }
        .hero-subtitle {
          font-family: var(--font-body);
          font-size: clamp(18px, 2vw, 22px);
          color: var(--neutral-600);
          max-width: 600px;
          margin: 24px auto 48px auto;
          line-height: 1.5;
        }

        /* Search Command Center */
        .search-container {
          position: relative;
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(32px);
          -webkit-backdrop-filter: blur(32px);
          border: 1px solid rgba(255, 255, 255, 1);
          box-shadow: 0 8px 32px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(255,255,255,0.5);
          transition: all 400ms var(--ease-out);
          overflow: hidden;
        }
        .search-container.focused {
          transform: scale(1.02) translateY(-4px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.08), inset 0 0 0 2px var(--ao);
          background: rgba(255, 255, 255, 0.95);
        }
        
        .search-input {
          width: 100%;
          height: 72px;
          padding: 0 24px 0 64px;
          border: none;
          outline: none;
          background: transparent;
          font-family: var(--font-body);
          font-size: 18px;
          color: var(--kuro);
        }
        .search-input::placeholder { color: var(--neutral-400); }
        
        .search-icon {
          position: absolute;
          left: 24px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--neutral-400);
          transition: color 200ms var(--ease-out);
        }
        .search-container.focused .search-icon { color: var(--ao); }
        
        /* Pressable Buttons */
        .btn-pressable {
          transition: transform 160ms var(--ease-out), background 160ms var(--ease-out);
        }
        .btn-pressable:active { transform: scale(0.97); }

        .search-btn {
          position: absolute;
          right: 8px;
          top: 8px;
          bottom: 8px;
          padding: 0 28px;
          background: var(--kuro);
          color: var(--shiro);
          border: none;
          border-radius: 12px;
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 200ms var(--ease-out);
        }
        .search-btn:hover { background: var(--neutral-900); }
        .search-btn:active { transform: scale(0.95); }

        /* Premium Rounded Cards */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 32px;
          margin-top: 120px;
        }
        .premium-card {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.9);
          border-radius: 32px;
          padding: 40px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.02);
          transition: all 400ms var(--ease-out);
          position: relative;
        }
        .premium-card:hover {
          background: rgba(255, 255, 255, 1);
          transform: translateY(-8px);
          box-shadow: 0 24px 48px rgba(0,0,0,0.06);
        }
        
        .card-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: var(--neutral-50);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          color: var(--kuro);
          transition: all 300ms var(--ease-out);
        }
        .premium-card:hover .card-icon-wrap {
          background: var(--card-accent);
          color: var(--shiro);
          transform: scale(1.05);
        }

        /* Emil Staggered Reveals */
        .stagger-1 { animation: slide-up 800ms var(--ease-out) 0.1s forwards; opacity: 0; transform: translateY(30px) scale(0.95); }
        .stagger-2 { animation: slide-up 800ms var(--ease-out) 0.2s forwards; opacity: 0; transform: translateY(30px) scale(0.95); }
        .stagger-3 { animation: slide-up 800ms var(--ease-out) 0.3s forwards; opacity: 0; transform: translateY(30px) scale(0.95); }
        .stagger-4 { animation: slide-up 800ms var(--ease-out) 0.4s forwards; opacity: 0; transform: translateY(30px) scale(0.95); }
        
        @keyframes slide-up {
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ambient-orb { animation: none; }
          .stagger-1, .stagger-2, .stagger-3, .stagger-4 { animation: none; opacity: 1; transform: none; }
          .search-container.focused { transform: none; }
          .btn-pressable:active, .search-btn:active { transform: none; }
          .premium-card:hover { transform: none; }
          .premium-card:hover .card-icon-wrap { transform: none; }
        }
      `}</style>

      {/* AMBIENT BACKGROUND */}
      <div className="ambient-bg">
        <div className="ambient-orb orb-red" />
        <div className="ambient-orb orb-blue" />
      </div>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* GLASS NAV */}
        <nav className="premium-nav glass-pill stagger-1">
          <span className="nav-logo" style={{ color: 'var(--kuro)', margin: 0, fontSize: '20px' }}>TAIKAIX</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!authLoading && user && !user.isAnonymous ? (
              <Link href="/dashboard" className="btn-pressable" style={{ 
                fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--shiro)', 
                background: 'var(--kuro)', padding: '8px 20px', borderRadius: '20px', textDecoration: 'none'
              }}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-pressable" style={{ 
                  fontFamily: 'var(--font-body)', color: 'var(--neutral-600)', fontSize: '14px', fontWeight: 600, 
                  textDecoration: 'none', padding: '8px 16px', transition: 'color 0.2s' 
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--kuro)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--neutral-600)')}
                >
                  Sign In
                </Link>
                <Link href="/login" className="btn-pressable" style={{ 
                  fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--shiro)', 
                  background: 'var(--kuro)', padding: '8px 24px', borderRadius: '20px', textDecoration: 'none'
                }}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* MAIN CANVAS */}
        <main style={{ flex: 1, padding: 'clamp(80px, 10vw, 120px) var(--space-6) var(--space-8)', position: 'relative', zIndex: 10 }}>
          
          <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
            
            <h1 className="hero-title stagger-2">
              Run Tournaments<br />
              <span style={{ color: 'var(--aka)' }}>Beautifully.</span>
            </h1>
            
            <p className="hero-subtitle stagger-3">
              The premier operations platform for martial arts. Live brackets, dynamic mat queues, and a stunning athlete experience.
            </p>

            {/* COMMAND CENTER */}
            <div className="stagger-4" style={{ width: '100%', padding: '0 16px' }}>
              <form onSubmit={handleSearch} className={`search-container ${isSearchFocused ? 'focused' : ''}`}>
                <Search size={22} className="search-icon" strokeWidth={2.5} />
                <input
                  ref={inputRef}
                  type="text"
                  className="search-input"
                  placeholder="Enter tournament ID or paste link..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  aria-label="Search for a tournament"
                  autoComplete="off"
                />
                <button type="submit" className="search-btn" aria-label="Find tournament">
                  Find Event
                </button>
              </form>

              {/* RECENT INVITES */}
              {mounted && recentInvites.length > 0 && (
                <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  {recentInvites.map((invite) => (
                    <Link key={invite.id} href={`/competitions/${invite.id}`} className="btn-pressable" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                      borderRadius: '32px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,1)', color: 'var(--neutral-700)', fontSize: '13px',
                      fontWeight: 600, textDecoration: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.03)'
                    }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--kuro)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--neutral-700)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.03)'; }}
                    >
                      {invite.name}
                      <span onClick={(e) => removeInvite(invite.id, e)} style={{ 
                        display: 'flex', alignItems: 'center', color: 'var(--neutral-400)', transition: 'color 160ms'
                      }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--aka)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--neutral-400)'}
                      >
                        <X size={14} strokeWidth={3} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* PREMIUM FEATURES GRID */}
            <div className="features-grid stagger-4" style={{ animationDelay: '0.5s' }}>
              {features.map((feature, idx) => (
                <div key={idx} className="premium-card" style={{ '--card-accent': feature.accent } as React.CSSProperties}>
                  <div className="card-icon-wrap">
                    {feature.icon}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '24px', fontWeight: 600, color: 'var(--kuro)', marginBottom: '12px', textAlign: 'left' }}>
                    {feature.title}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--neutral-600)', lineHeight: 1.6, textAlign: 'left' }}>
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
            
          </div>
        </main>
      </div>
    </>
  );
}
