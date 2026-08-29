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
        /* Brutalist / Combat Sports Aesthetic */
        :root {
          --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Stark Ambient Background */
        .ambient-bg {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #FFFFFF;
          background-image: radial-gradient(var(--neutral-300) 1px, transparent 1px);
          background-size: 24px 24px;
          opacity: 0.4;
          z-index: -1;
        }

        /* Sharp Nav */
        .premium-nav {
          position: sticky;
          top: 0;
          margin: 0;
          width: 100%;
          max-width: 100%;
          height: 64px;
          background: #FFFFFF;
          border-bottom: 2px solid var(--kuro);
          display: flex;
          align-items: center;
          padding: 0 24px;
          z-index: 100;
        }

        /* Hero Typography */
        .hero-title {
          font-family: var(--font-display);
          font-size: clamp(56px, 12vw, 110px);
          line-height: 0.9;
          color: var(--kuro);
          text-transform: uppercase;
          letter-spacing: -0.04em;
          text-wrap: balance;
          font-weight: 900;
          font-style: italic;
        }
        .hero-subtitle {
          font-family: var(--font-body);
          font-size: clamp(16px, 1.5vw, 20px);
          color: var(--neutral-600);
          max-width: 600px;
          margin: 24px auto 48px auto;
          line-height: 1.6;
          font-weight: 500;
        }

        /* Search Command Center - Brutalist */
        .search-container {
          position: relative;
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          background: #FFFFFF;
          border: 3px solid var(--kuro);
          box-shadow: 6px 6px 0px var(--aka);
          transition: transform 200ms var(--ease-out), box-shadow 200ms var(--ease-out);
          display: flex;
        }
        .search-container.focused {
          transform: translate(-2px, -2px);
          box-shadow: 8px 8px 0px var(--aka);
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
          font-weight: 600;
          color: var(--kuro);
        }
        .search-input::placeholder { color: var(--neutral-400); font-weight: 500; }
        
        .search-icon {
          position: absolute;
          left: 24px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--kuro);
        }
        
        /* Pressable Buttons */
        .btn-pressable {
          transition: transform 100ms linear;
        }
        .btn-pressable:active { transform: scale(0.96); }

        .search-btn {
          margin: 6px;
          padding: 0 32px;
          background: var(--kuro);
          color: var(--shiro);
          border: none;
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 150ms;
        }
        .search-btn:hover { background: var(--aka); }

        /* Minimal Rounded Cards */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 32px;
          margin-top: 100px;
        }
        .premium-card {
          background: #FFFFFF;
          border: 3px solid var(--kuro);
          padding: 32px;
          box-shadow: 6px 6px 0px var(--neutral-200);
          transition: transform 200ms var(--ease-out), box-shadow 200ms var(--ease-out);
          position: relative;
        }
        .premium-card:hover {
          box-shadow: 8px 8px 0px var(--card-accent);
          transform: translate(-2px, -2px);
        }
        
        .card-icon-wrap {
          width: 56px;
          height: 56px;
          border: 2px solid var(--kuro);
          background: #FFF;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          color: var(--kuro);
          transition: background 200ms var(--ease-out), color 200ms var(--ease-out), border-color 200ms var(--ease-out);
        }
        .premium-card:hover .card-icon-wrap {
          background: var(--card-accent);
          color: var(--shiro);
          border-color: var(--card-accent);
        }

        /* Snappy Reveals */
        .stagger-1 { animation: slide-up 400ms var(--ease-out) 0s forwards; opacity: 0; transform: translateY(15px); }
        .stagger-2 { animation: slide-up 400ms var(--ease-out) 0.05s forwards; opacity: 0; transform: translateY(15px); }
        .stagger-3 { animation: slide-up 400ms var(--ease-out) 0.1s forwards; opacity: 0; transform: translateY(15px); }
        .stagger-4 { animation: slide-up 400ms var(--ease-out) 0.15s forwards; opacity: 0; transform: translateY(15px); }
        
        @keyframes slide-up {
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .stagger-1, .stagger-2, .stagger-3, .stagger-4 { animation: none; opacity: 1; transform: none; }
          .search-container.focused { transform: none; }
          .premium-card:hover { transform: none; }
        }
      `}</style>

      {/* SOLID BACKGROUND */}
      <div className="ambient-bg" />

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* MINIMAL NAV */}
        <nav className="premium-nav stagger-1">
          <span className="nav-logo" style={{ color: 'var(--kuro)', margin: 0, fontSize: '24px', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.04em' }}>TAIKAIX</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
            {!authLoading && user && !user.isAnonymous ? (
              <Link href="/dashboard" className="btn-pressable" style={{ 
                fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--shiro)', 
                background: 'var(--kuro)', padding: '10px 24px', textDecoration: 'none', textTransform: 'uppercase'
              }}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-pressable" style={{ 
                  fontFamily: 'var(--font-display)', color: 'var(--kuro)', fontSize: '15px', fontWeight: 700, 
                  textDecoration: 'none', padding: '10px 16px', textTransform: 'uppercase'
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--aka)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--kuro)')}
                >
                  Sign In
                </Link>
                <Link href="/login" className="btn-pressable" style={{ 
                  fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--shiro)', 
                  background: 'var(--kuro)', padding: '10px 24px', textDecoration: 'none', textTransform: 'uppercase'
                }}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* MAIN CANVAS */}
        <main style={{ flex: 1, padding: 'clamp(80px, 10vw, 120px) var(--space-6) var(--space-8)', position: 'relative', zIndex: 10 }}>
          
          <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
            
            <h1 className="hero-title stagger-2">
              RUN TOURNAMENTS.<br />
              <span style={{ color: 'var(--aka)' }}>DOMINATE THE MAT.</span>
            </h1>
            
            <p className="hero-subtitle stagger-3">
              The premier operations platform for martial arts. Live brackets, dynamic mat queues, and a professional athlete experience.
            </p>

            {/* COMMAND CENTER */}
            <div className="stagger-4" style={{ width: '100%', padding: '0 16px' }}>
              <form onSubmit={handleSearch} className={`search-container ${isSearchFocused ? 'focused' : ''}`}>
                <Search size={24} className="search-icon" strokeWidth={3} />
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
                  Find
                </button>
              </form>

              {/* RECENT INVITES */}
              {mounted && recentInvites.length > 0 && (
                <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  {recentInvites.map((invite) => (
                    <Link key={invite.id} href={`/competitions/${invite.id}`} className="btn-pressable" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                      background: '#FFFFFF', border: '2px solid var(--kuro)', color: 'var(--kuro)', fontSize: '14px',
                      fontWeight: 700, textDecoration: 'none', boxShadow: '3px 3px 0px var(--neutral-300)'
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--aka)'; e.currentTarget.style.color = 'var(--aka)'; e.currentTarget.style.boxShadow = '4px 4px 0px var(--aka)'; e.currentTarget.style.transform = 'translate(-1px, -1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--kuro)'; e.currentTarget.style.color = 'var(--kuro)'; e.currentTarget.style.boxShadow = '3px 3px 0px var(--neutral-300)'; e.currentTarget.style.transform = 'none'; }}
                    >
                      {invite.name}
                      <span onClick={(e) => removeInvite(invite.id, e)} style={{ 
                        display: 'flex', alignItems: 'center', color: 'var(--neutral-400)', transition: 'color 160ms'
                      }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--aka)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--neutral-400)'}
                      >
                        <X size={16} strokeWidth={3} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* MINIMAL FEATURES GRID */}
            <div className="features-grid stagger-4" style={{ animationDelay: '0.2s' }}>
              {features.map((feature, idx) => (
                <div key={idx} className="premium-card" style={{ '--card-accent': feature.accent } as React.CSSProperties}>
                  <div className="card-icon-wrap">
                    {feature.icon}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, color: 'var(--kuro)', marginBottom: '8px', textAlign: 'left', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                    {feature.title}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--neutral-600)', lineHeight: 1.6, textAlign: 'left', fontWeight: 500 }}>
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
