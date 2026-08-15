'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Trophy, Users, Activity, ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/modules/auth/components/AuthProvider';

export default function LandingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [recentInvites, setRecentInvites] = useState<{id: string, name: string, date: number}[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Load recent invites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('taikaix_recent_invites');
      if (stored) {
        setRecentInvites(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Error loading recent invites', err);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Direct navigation if they paste an exact ID, else we route to public search page
      if (searchQuery.length >= 20) {
        router.push(`/competitions/${searchQuery}`);
      } else {
        router.push(`/competitions?q=${encodeURIComponent(searchQuery)}`);
      }
    }
  };

  const removeInvite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = recentInvites.filter(inv => inv.id !== id);
    setRecentInvites(updated);
    localStorage.setItem('taikaix_recent_invites', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col items-center selection:bg-blue-500/30 overflow-hidden relative">
      
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />

      {/* Navigation */}
      <nav className="w-full max-w-6xl mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold shadow-lg shadow-blue-500/20">
            T
          </div>
          <span className="text-xl font-bold tracking-tight">TaikaiX</span>
        </div>
        <div className="flex gap-4">
          {!authLoading && user ? (
            <Link 
              href="/dashboard"
              className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200 text-sm font-medium border border-white/10 active:scale-[0.97]"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link 
                href="/login"
                className="px-5 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href="/login"
                className="px-5 py-2 rounded-full bg-white text-black hover:bg-gray-200 transition-all duration-200 text-sm font-medium active:scale-[0.97]"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 pt-24 pb-32 flex flex-col items-center text-center z-10">
        <div 
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-gray-300 mb-8 stagger-item delay-0"
          style={{ animation: 'fadeSlideIn 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards' }}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          The new standard for martial arts
        </div>
        
        <h1 
          className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-[1.1] stagger-item delay-1"
          style={{ animation: 'fadeSlideIn 0.8s cubic-bezier(0.23, 1, 0.32, 1) 0.1s forwards', opacity: 0 }}
        >
          Run tournaments with <br className="hidden md:block" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
            absolute precision.
          </span>
        </h1>
        
        <p 
          className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12 stagger-item delay-2"
          style={{ animation: 'fadeSlideIn 0.8s cubic-bezier(0.23, 1, 0.32, 1) 0.2s forwards', opacity: 0 }}
        >
          Live brackets, real-time mat displays, and seamless athlete management. 
          Built for organizers who demand excellence.
        </p>

        {/* Search / Invite Link */}
        <form 
          onSubmit={handleSearch}
          className="w-full max-w-md relative mb-20 stagger-item delay-3"
          style={{ animation: 'fadeSlideIn 0.8s cubic-bezier(0.23, 1, 0.32, 1) 0.3s forwards', opacity: 0 }}
        >
          <div className={`
            flex items-center bg-white/5 border rounded-full px-4 py-3 transition-all duration-300
            ${isSearchFocused ? 'border-blue-500/50 bg-white/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]' : 'border-white/10 hover:border-white/20'}
          `}>
            <Search className={`w-5 h-5 mr-3 transition-colors ${isSearchFocused ? 'text-blue-400' : 'text-gray-500'}`} />
            <input
              type="text"
              placeholder="Paste invite link or tournament ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="bg-transparent border-none outline-none flex-1 text-sm placeholder:text-gray-500 text-white"
            />
            <button 
              type="submit"
              className="ml-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full p-2 transition-transform active:scale-[0.92]"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Recent Invites (if any) */}
        {recentInvites.length > 0 && (
          <div 
            className="w-full max-w-2xl text-left stagger-item delay-4"
            style={{ animation: 'fadeSlideIn 0.8s cubic-bezier(0.23, 1, 0.32, 1) 0.4s forwards', opacity: 0 }}
          >
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 pl-2">Your Recent Events</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentInvites.map((invite) => (
                <Link
                  key={invite.id}
                  href={`/competitions/${invite.id}`}
                  className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all duration-300 block active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <Trophy className="w-5 h-5 text-blue-400" />
                    <button 
                      onClick={(e) => removeInvite(invite.id, e)}
                      className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="font-semibold text-gray-200 group-hover:text-white transition-colors">{invite.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">Visited {new Date(invite.date).toLocaleDateString()}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Feature Grid (Bento Box) */}
        {!recentInvites.length && (
          <div 
            className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-10 stagger-item delay-4"
            style={{ animation: 'fadeSlideIn 0.8s cubic-bezier(0.23, 1, 0.32, 1) 0.4s forwards', opacity: 0 }}
          >
            {[
              { title: "Live Brackets", icon: <Trophy />, desc: "Automated advancement and tie-breakers. Always up to date." },
              { title: "Mat Management", icon: <Activity />, desc: "Real-time queueing and digital scoreboards for every mat." },
              { title: "Athlete Portal", icon: <Users />, desc: "Self-service check-in and live schedule tracking for competitors." }
            ].map((feat, i) => (
              <div 
                key={i} 
                className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-left hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-blue-400 mb-4">
                  {feat.icon}
                </div>
                <h3 className="text-lg font-medium text-gray-200 mb-2">{feat.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <style jsx global>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
