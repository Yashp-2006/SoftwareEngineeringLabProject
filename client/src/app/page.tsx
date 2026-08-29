'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowRight, Trophy, Activity, Users } from 'lucide-react';
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
    { icon: <Trophy size={32} strokeWidth={1.5} />, title: 'Live Brackets', desc: 'Real-time advancement and tie-breakers. Automatic syncing across all officials.', accent: 'var(--aka)' },
    { icon: <Activity size={32} strokeWidth={1.5} />, title: 'Mat Queues', desc: 'Digital scoreboards and dynamic scheduling. Eliminate paper brackets entirely.', accent: 'var(--ao)' },
    { icon: <Users size={32} strokeWidth={1.5} />, title: 'Athlete Portal', desc: 'Self-service check-in. Competitors track their exact match time live.', accent: 'var(--shiro)' },
  ];

  return (
    <>
      <style>{`
        /* Core Physics & Custom Easings (Emil-Design-Eng) */
        :root {
          --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
          --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
        }

        /* Combat Sports Grid Background */
        .bg-grid {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: var(--kuro);
          background-image: 
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 64px 64px;
          background-position: center center;
          z-index: -1;
        }

        /* Radial Vignette */
        .bg-vignette {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(circle at 50% 30%, transparent 20%, var(--kuro) 100%);
          z-index: -1;
          pointer-events: none;
        }

        /* Nav */
        .combat-nav {
          height: var(--nav-height);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          padding: 0 var(--space-6);
          background: rgba(13,13,13,0.8);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        /* Hero Typography */
        .hero-title {
          font-family: var(--font-display);
          font-size: clamp(64px, 12vw, 140px);
          line-height: 0.9;
          color: var(--shiro);
          text-transform: uppercase;
          letter-spacing: -0.01em;
          text-shadow: 0 4px 24px rgba(0,0,0,0.8);
          font-style: italic;
          margin-bottom: 24px;
        }
        
        /* Scoreboard Search Center */
        .search-container {
          position: relative;
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          transition: border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out);
        }
        .search-container.focused {
          border-color: var(--aka);
          box-shadow: 0 0 0 1px var(--aka), 0 8px 32px rgba(217,38,44,0.15);
          background: rgba(255,255,255,0.05);
        }
        
        .search-input {
          width: 100%;
          height: 64px;
          padding: 0 24px 0 64px;
          border: none;
          outline: none;
          background: transparent;
          font-family: var(--font-mono);
          font-size: 16px;
          color: var(--shiro);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .search-input::placeholder { color: rgba(255,255,255,0.3); text-transform: none; font-family: var(--font-body); letter-spacing: normal; }
        
        .search-icon {
          position: absolute;
          left: 24px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.4);
          transition: color 200ms var(--ease-out);
        }
        .search-container.focused .search-icon { color: var(--aka); }
        
        /* Pressable Button standard */
        .btn-pressable {
          transition: transform 160ms var(--ease-out), background 160ms var(--ease-out);
        }
        .btn-pressable:active {
          transform: scale(0.97);
        }

        .search-btn {
          position: absolute;
          right: 8px;
          top: 8px;
          bottom: 8px;
          padding: 0 24px;
          background: var(--shiro);
          color: var(--kuro);
          border: none;
          border-radius: 4px;
          font-family: var(--font-display);
          font-size: 20px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .search-btn:hover { background: var(--neutral-300); }

        /* Brutalist Sliced Cards */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
          margin-top: 120px;
        }
        .combat-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          /* Brutalist slice bottom right */
          clip-path: polygon(0 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%);
          padding: 40px 32px;
          position: relative;
          transition: background 200ms var(--ease-out), transform 200ms var(--ease-out);
        }
        .combat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 4px;
          background: rgba(255,255,255,0.1);
          transition: background 200ms var(--ease-out);
        }
        
        .combat-card:hover {
          background: rgba(255,255,255,0.05);
          transform: translateY(-4px);
        }
        .combat-card:hover::before {
          background: var(--card-accent);
        }
        
        .card-icon {
          color: rgba(255,255,255,0.5);
          margin-bottom: 24px;
          transition: color 200ms var(--ease-out), transform 200ms var(--ease-out);
        }
        .combat-card:hover .card-icon {
          color: var(--card-accent);
          transform: scale(1.1) translateX(4px);
        }

        /* Emil Staggered Reveals (scale(0.95) -> 1) */
        .stagger-1 { animation: slide-up 600ms var(--ease-out) 0.1s forwards; opacity: 0; transform: translateY(20px) scale(0.95); }
        .stagger-2 { animation: slide-up 600ms var(--ease-out) 0.2s forwards; opacity: 0; transform: translateY(20px) scale(0.95); }
        .stagger-3 { animation: slide-up 600ms var(--ease-out) 0.3s forwards; opacity: 0; transform: translateY(20px) scale(0.95); }
        .stagger-4 { animation: slide-up 600ms var(--ease-out) 0.4s forwards; opacity: 0; transform: translateY(20px) scale(0.95); }
        
        @keyframes slide-up {
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .stagger-1, .stagger-2, .stagger-3, .stagger-4 { animation: none; opacity: 1; transform: none; }
          .btn-pressable:active { transform: none; }
          .combat-card:hover { transform: none; }
          .combat-card:hover .card-icon { transform: none; }
        }
      `}</style>

      {/* BACKGROUND */}
      <div className="bg-grid" />
      <div className="bg-vignette" />

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* COMBAT NAV */}
        <nav className="combat-nav stagger-1">
          <span className="nav-logo" style={{ color: 'var(--shiro)' }} aria-label="TaikaiX home">TAIKAIX</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
            {!authLoading && user && !user.isAnonymous ? (
              <Link href="/dashboard" className="btn-pressable" style={{ 
                fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--kuro)', 
                background: 'var(--shiro)', padding: '6px 20px', borderRadius: '4px', textDecoration: 'none',
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" style={{ 
                  fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.6)', fontSize: '18px', 
                  textDecoration: 'none', padding: '6px 12px', transition: 'color 200ms',
                  textTransform: 'uppercase', letterSpacing: '0.05em'
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--shiro)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                >
                  Sign In
                </Link>
                <Link href="/login" className="btn-pressable" style={{ 
                  fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--shiro)', 
                  background: 'var(--aka)', padding: '6px 20px', borderRadius: '4px', textDecoration: 'none',
                  textTransform: 'uppercase', letterSpacing: '0.05em'
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
              <span style={{ color: 'var(--aka)' }}>
                With Precision.
              </span>
            </h1>
            
            <p className="stagger-3" style={{
              fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '48px'
            }}>
              // Live Brackets • Mat Queues • Real-Time Scoring //
            </p>

            {/* COMMAND CENTER SCOREBOARD */}
            <div className="stagger-4" style={{ width: '100%', padding: '0 16px' }}>
              <form onSubmit={handleSearch} className={`search-container ${isSearchFocused ? 'focused' : ''}`}>
                <Search size={20} className="search-icon" strokeWidth={3} />
                <input
                  ref={inputRef}
                  type="text"
                  className="search-input"
                  placeholder="Enter Tournament ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  aria-label="Search for a tournament"
                  autoComplete="off"
                />
                <button type="submit" className="search-btn btn-pressable" aria-label="Find tournament">
                  Find
                </button>
              </form>

              {/* RECENT INVITES */}
              {mounted && recentInvites.length > 0 && (
                <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  {recentInvites.map((invite) => (
                    <Link key={invite.id} href={`/competitions/${invite.id}`} className="btn-pressable" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--shiro)', fontFamily: 'var(--font-mono)', fontSize: '13px',
                      textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ao)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    >
                      {invite.name}
                      <span onClick={(e) => removeInvite(invite.id, e)} style={{ 
                        display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.3)', transition: 'color 160ms'
                      }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--aka)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                      >
                        <X size={14} strokeWidth={3} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* BRUTALIST SLICED FEATURES */}
            <div className="features-grid stagger-4" style={{ animationDelay: '0.5s' }}>
              {features.map((feature, idx) => (
                <div key={idx} className="combat-card" style={{ '--card-accent': feature.accent } as React.CSSProperties}>
                  <div className="card-icon">
                    {feature.icon}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--shiro)', marginBottom: '8px', textAlign: 'left', letterSpacing: '0.02em' }}>
                    {feature.title}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, textAlign: 'left' }}>
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
