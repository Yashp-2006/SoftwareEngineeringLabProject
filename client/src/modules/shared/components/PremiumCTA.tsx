import React from 'react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';

interface PremiumCTAProps {
  title?: string;
  description?: string;
  buttonText?: string;
  href?: string;
  onClick?: () => void;
}

export default function PremiumCTA({
  title = "No competitions yet",
  description = "Create your first competition to start managing brackets, mats, and athletes.",
  buttonText = "Create Competition",
  href,
  onClick
}: PremiumCTAProps) {
  return (
    <div style={{
      background: 'var(--shiro)',
      border: '1.5px dashed var(--neutral-300)',
      borderRadius: '12px',
      padding: '48px 32px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: '16px',
    }}>
      {/* Icon */}
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '10px',
        background: 'var(--aka-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--aka)',
        flexShrink: 0,
      }}>
        <Plus size={22} aria-hidden="true" />
      </div>

      {/* Text */}
      <div style={{ maxWidth: '420px' }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: 'var(--neutral-900)',
          marginBottom: '8px',
        }}>
          {title}
        </h3>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          color: 'var(--neutral-500)',
          lineHeight: 1.6,
        }}>
          {description}
        </p>
      </div>

      {/* CTA */}
      {onClick ? (
        <button
          onClick={onClick}
          className="btn btn-primary"
          style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} aria-hidden="true" />
          {buttonText}
        </button>
      ) : href ? (
        <Link
          href={href}
          className="btn btn-primary"
          style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
        >
          {buttonText}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
