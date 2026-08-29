'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, Trophy, Activity, Users, X } from 'lucide-react';
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

  // Signed-in users never need the landing page
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
    {
      icon: <Trophy aria-hidden="true" />,
      title: 'Live Brackets',
      desc: 'Automated advancement and tie-breakers. Always current.',
    },
    {
      icon: <Activity aria-hidden="true" />,
      title: 'Mat Management',
      desc: 'Real-time queuing and digital scoreboards for every mat.',
    },
    {
      icon: <Users aria-hidden="true" />,
      title: 'Athlete Portal',
      desc: 'Self-service check-in and live schedule tracking for competitors.',
    },
  ];

  return (
    <>
      <style>{`
        /* Landing-page-scoped animations */
        @keyframes lp-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes lp-line-grow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes lp-pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.4); opacity: 0.7; }
        }

        .lp-anim-0 { opacity: 0; animation: lp-fade-up 0.55s var(--ease-out) 0.05s forwards; }
        .lp-anim-1 { opacity: 0; animation: lp-fade-up 0.55s var(--ease-out) 0.18s forwards; }
        .lp-anim-2 { opacity: 0; animation: lp-fade-up 0.55s var(--ease-out) 0.30s forwards; }
        .lp-anim-3 { opacity: 0; animation: lp-fade-up 0.55s var(--ease-out) 0.42s forwards; }
        .lp-anim-4 { opacity: 0; animation: lp-fade-up 0.55s var(--ease-out) 0.54s forwards; }

        .lp-feature-card { transition: box-shadow 180ms var(--ease-out), transform 180ms var(--ease-out); }
        .lp-feature-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.10); transform: translateY(-3px); }

        .lp-search-wrap { transition: box-shadow 160ms var(--ease-out), border-color 160ms var(--ease-out); }
        .lp-search-focused { border-color: var(--ao) !important; box-shadow: 0 0 0 3px rgba(26,77,181,0.12); }

        .lp-cta-primary {
          display: inline-flex; align-items: center; gap: 8px;
          height: 48px; padding: 0 28px;
          background: var(--aka); color: var(--shiro);
          font-family: var(--font-body); font-size: 15px; font-weight: 600;
          border: none; border-radius: 8px; cursor: pointer; text-decoration: none;
          transition: background 160ms var(--ease-out), transform 160ms var(--ease-out);
          white-space: nowrap;
        }
        .lp-cta-primary:hover  { background: var(--aka-hover); }
        .lp-cta-primary:active { transform: scale(0.97); }

        .lp-cta-ghost {
          display: inline-flex; align-items: center;
          height: 48px; padding: 0 24px;
          color: var(--neutral-700); background: transparent;
          font-family: var(--font-body); font-size: 15px; font-weight: 500;
          border: 1.5px solid var(--neutral-300); border-radius: 8px;
          cursor: pointer; text-decoration: none;
          transition: border-color 160ms var(--ease-out), color 160ms var(--ease-out), background 160ms var(--ease-out);
          white-space: nowrap;
        }
        .lp-cta-ghost:hover { border-color: var(--neutral-500); color: var(--neutral-900); background: var(--neutral-100); }

        .lp-divider { width: 48px; height: 3px; background: var(--aka); transform-origin: left; animation: lp-line-grow 0.5s var(--ease-out) 0.55s both; }

        .lp-invite-card {
          display: block; position: relative;
          background: var(--shiro); border: 1px solid var(--neutral-200);
          border-radius: 10px; padding: 16px 20px;
          text-decoration: none;
          transition: border-color 180ms var(--ease-out), box-shadow 180ms var(--ease-out);
        }
        .lp-invite-card:hover { border-color: var(--ao); box-shadow: 0 4px 16px rgba(26,77,181,0.08); }

        @media (prefers-reduced-motion: reduce) {
          .lp-anim-0, .lp-anim-1, .lp-anim-2, .lp-anim-3, .lp-anim-4 {
            opacity: 1 !important; animation: none !important;
          }
          .lp-divider { animation: none; transform: scaleX(1); }
          .lp-feature-card:hover, .lp-invite-card:hover { transform: none; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--neutral-50)', display: 'flex', flexDirection: 'column' }}>

        {/* ── NAV ── */}
        <nav style={{
          height: 'var(--nav-height)',
          background: 'var(--kuro)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-6)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}>
          <span className="nav-logo" aria-label="TaikaiX home">TAIKAIX</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {!authLoading && user && !user.isAnonymous ? (
              <Link href="/dashboard" className="btn btn-secondary" style={{ fontSize: '14px', height: '38px', padding: '0 18px', color: 'var(--shiro)', borderColor: 'rgba(255,255,255,0.3)' }}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" style={{ color: 'var(--neutral-300)', fontSize: '14px', fontWeight: 500, textDecoration: 'none', padding: '8px 4px', transition: 'color 160ms' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--shiro)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--neutral-300)')}
                >
                  Sign In
                </Link>
                <Link href="/login" className="lp-cta-primary" style={{ height: '38px', padding: '0 18px', fontSize: '14px' }}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* ── HERO ── */}
        <main style={{ flex: 1, maxWidth: '1100px', margin: '0 auto', width: '100%', padding: 'clamp(48px,8vw,96px) var(--space-6) var(--space-8)' }}>

          {/* Eyebrow */}
          <div className="lp-anim-0" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--aka)',
              display: 'inline-block',
              animation: 'lp-pulse-dot 2s ease-in-out infinite',
            }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--neutral-600)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Tournament Operations Platform
            </span>
          </div>

          {/* Headline */}
          <h1
            className="lp-anim-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(52px, 8vw, 96px)',
              lineHeight: 1.0,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              color: 'var(--kuro)',
              maxWidth: '820px',
              marginBottom: '12px',
              textWrap: 'balance',
            }}
          >
            Run tournaments with{' '}
            <span style={{ color: 'var(--aka)' }}>absolute</span>{' '}
            precision.
          </h1>

          <div className="lp-divider" style={{ marginBottom: '28px' }} />

          {/* Sub-copy */}
          <p
            className="lp-anim-2"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(16px, 2vw, 19px)',
              color: 'var(--neutral-600)',
              maxWidth: '580px',
              lineHeight: 1.6,
              marginBottom: '40px',
            }}
          >
            Live brackets, real-time mat displays, and athlete management — built for officials who need speed under pressure.
          </p>

          {/* CTA row */}
          {!authLoading && (
            <div className="lp-anim-2" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '56px' }}>
              {user && !user.isAnonymous ? (
                <Link href="/dashboard" className="lp-cta-primary">
                  Go to Dashboard <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : (
                <>
                  <Link href="/login" className="lp-cta-primary">
                    Get Started <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <Link href="/competitions" className="lp-cta-ghost">
                    Browse Events
                  </Link>
                </>
              )}
            </div>
          )}

          {/* Search bar */}
          <div className="lp-anim-3" style={{ maxWidth: '520px', marginBottom: '64px' }}>
            <form onSubmit={handleSearch}>
              <div
                className={`lp-search-wrap${isSearchFocused ? ' lp-search-focused' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center',
                  background: 'var(--shiro)',
                  border: '1.5px solid var(--neutral-300)',
                  borderRadius: '10px',
                  padding: '0 8px 0 16px',
                  height: '52px',
                }}
              >
                <Search
                  size={18}
                  aria-hidden="true"
                  style={{ color: isSearchFocused ? 'var(--ao)' : 'var(--neutral-400)', flexShrink: 0, transition: 'color 160ms' }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Paste invite link or tournament ID…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  aria-label="Search for a tournament"
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--neutral-900)',
                    padding: '0 12px',
                  }}
                />
                <button
                  type="submit"
                  aria-label="Find tournament"
                  style={{
                    background: 'var(--ao)', color: 'var(--shiro)',
                    border: 'none', borderRadius: '7px',
                    width: '36px', height: '36px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                    transition: 'background 160ms var(--ease-out), transform 160ms var(--ease-out)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--ao-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--ao)')}
                  onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>

          {/* Recent invites */}
          {mounted && recentInvites.length > 0 && (
            <section className="lp-anim-3" style={{ marginBottom: '64px' }} aria-label="Recently visited events">
              <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neutral-500)', marginBottom: '16px' }}>
                Recent Events
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                {recentInvites.map(invite => (
                  <Link key={invite.id} href={`/competitions/${invite.id}`} className="lp-invite-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <Trophy size={16} style={{ color: 'var(--ao)' }} aria-hidden="true" />
                      <button
                        onClick={e => removeInvite(invite.id, e)}
                        aria-label={`Remove ${invite.name} from recent`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', display: 'flex', padding: '2px', borderRadius: '4px', transition: 'color 160ms' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--aka)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--neutral-400)')}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 600, color: 'var(--neutral-900)', marginBottom: '4px' }}>{invite.name}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--neutral-500)' }}>Visited {new Date(invite.date).toLocaleDateString()}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Feature strip */}
          <div className="lp-anim-4">
            <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neutral-500)', marginBottom: '20px' }}>
              Platform Capabilities
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              {features.map((feat, i) => (
                <div
                  key={i}
                  className="lp-feature-card"
                  style={{
                    background: 'var(--shiro)',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: '12px',
                    padding: '24px',
                  }}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '8px',
                    background: 'var(--ao-light)', color: 'var(--ao)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '16px',
                  }}>
                    {feat.icon}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--kuro)', marginBottom: '8px' }}>
                    {feat.title}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--neutral-600)', lineHeight: 1.6 }}>
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* ── FOOTER ── */}
        <footer style={{
          borderTop: '1px solid var(--neutral-200)',
          padding: 'var(--space-5) var(--space-6)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '8px',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', letterSpacing: '0.05em', color: 'var(--kuro)' }}>TAIKAIX</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--neutral-500)' }}>
            Built for karate. Operated with precision.
          </span>
        </footer>
      </div>
    </>
  );
}
