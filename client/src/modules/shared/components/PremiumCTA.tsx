import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

interface PremiumCTAProps {
  title?: string;
  description?: string;
  buttonText?: string;
  href?: string;
  onClick?: () => void;
}

export default function PremiumCTA({
  title = "Ready to elevate your tournament?",
  description = "Join hundreds of world-class dojos using TaikaiX to run seamless, professional competitions with zero delays.",
  buttonText = "Deploy Your First Tournament",
  href,
  onClick
}: PremiumCTAProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        :root {
          /* Emil Kowalski custom easing curves */
          --cta-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
          --cta-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
        }

        .cta-container {
          position: relative;
          width: 100%;
          border-radius: 24px;
          overflow: hidden;
          background: linear-gradient(135deg, var(--neutral-900) 0%, #000 100%);
          color: var(--shiro);
          padding: 64px 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
          
          /* Entering animation (Emil style: scale up slightly with opacity) */
          opacity: 0;
          transform: translateY(20px) scale(0.98);
          transition: opacity 600ms var(--cta-ease-out), transform 600ms var(--cta-ease-out);
        }
        
        .cta-container[data-mounted="true"] {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        
        /* Ambient Background Glow */
        .cta-glow {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(26,77,181,0.2) 0%, transparent 70%);
          top: 50%;
          right: -10%;
          transform: translateY(-50%);
          border-radius: 50%;
          pointer-events: none;
        }

        .cta-content {
          max-width: 500px;
          z-index: 1;
        }

        .cta-title {
          font-family: var(--font-display);
          font-size: 42px;
          line-height: 1.1;
          font-weight: 700;
          margin-bottom: 16px;
          letter-spacing: -0.02em;
          background: linear-gradient(180deg, #FFFFFF 0%, rgba(255, 255, 255, 0.7) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-wrap: balance;
        }

        .cta-description {
          font-size: 16px;
          line-height: 1.6;
          color: var(--neutral-400);
          margin-bottom: 0;
        }

        /* Tactile, highly responsive button */
        .cta-button {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: var(--shiro);
          color: var(--neutral-900);
          padding: 18px 32px;
          border-radius: 100px;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          
          /* Interruptible transitions */
          transition: transform 160ms var(--cta-ease-out), box-shadow 200ms var(--cta-ease-out);
          transform-origin: center;
          will-change: transform;
        }

        /* Subtle ambient shadow */
        .cta-button:hover {
          box-shadow: 0 8px 24px rgba(255,255,255,0.15);
        }

        /* Essential Emil touch: scale(0.97) on press */
        .cta-button:active {
          transform: scale(0.97);
        }

        .cta-button-inner {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          /* Blur transition trick to hide ugly crossfades */
          transition: filter 200ms ease, opacity 200ms ease;
        }

        .cta-button:active .cta-button-inner {
          filter: blur(1.5px);
          opacity: 0.8;
        }
        
        .cta-button-icon {
          transition: transform 300ms var(--cta-ease-out);
        }
        
        /* Only apply hover animation if it's a mouse/fine pointer */
        @media (hover: hover) and (pointer: fine) {
          .cta-button:hover .cta-button-icon {
            transform: translateX(4px);
          }
        }

        /* Staggered entry logic */
        .stagger-item {
          opacity: 0;
          transform: translateY(10px);
          animation: ctaFadeIn 400ms var(--cta-ease-out) forwards;
        }
        
        @keyframes ctaFadeIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .stagger-1 { animation-delay: 150ms; }
        .stagger-2 { animation-delay: 250ms; }
        .stagger-3 { animation-delay: 350ms; }

        @media (max-width: 768px) {
          .cta-container {
            flex-direction: column;
            text-align: center;
            padding: 48px 24px;
          }
          .cta-content { margin: 0 auto; }
          .cta-button { width: 100%; justify-content: center; }
          .cta-glow { right: 50%; transform: translate(50%, -50%); top: 0; }
        }
        
        /* Accessibility */
        @media (prefers-reduced-motion: reduce) {
          .cta-container, .cta-button, .cta-button-inner, .stagger-item, .cta-button-icon {
            transition: none !important;
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}} />

      <section className="cta-container" data-mounted={mounted}>
        <div className="cta-glow"></div>
        <div className="cta-content">
          <h2 className="cta-title stagger-item stagger-1">{title}</h2>
          <p className="cta-description stagger-item stagger-2">{description}</p>
        </div>
        <div className="stagger-item stagger-3">
          {onClick ? (
            <button onClick={onClick} className="cta-button">
              <span className="cta-button-inner">
                <Sparkles size={18} style={{ color: 'var(--ao)' }} />
                {buttonText}
                <ArrowRight size={18} className="cta-button-icon" />
              </span>
            </button>
          ) : (
            <Link href={href || "#"} className="cta-button">
              <span className="cta-button-inner">
                <Sparkles size={18} style={{ color: 'var(--ao)' }} />
                {buttonText}
                <ArrowRight size={18} className="cta-button-icon" />
              </span>
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
