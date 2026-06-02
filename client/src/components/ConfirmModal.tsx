'use client';

import React, { useEffect, useState } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      const timer = setTimeout(() => setIsRendered(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen && !isRendered) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          opacity: ${isOpen ? 1 : 0};
          transition: opacity 0.2s ease;
        }
        .confirm-modal {
          background: var(--shiro);
          border-radius: 16px;
          padding: var(--space-5);
          width: 90%;
          max-width: 400px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          transform: ${isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)'};
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .confirm-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 var(--space-2) 0;
          color: var(--neutral-900);
        }
        .confirm-message {
          font-size: 14px;
          color: var(--neutral-600);
          margin: 0 0 var(--space-5) 0;
          line-height: 1.5;
        }
        .confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
        }
      `}} />
      <div className="confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
        <div className="confirm-modal">
          <h3 className="confirm-title">{title}</h3>
          <p className="confirm-message">{message}</p>
          <div className="confirm-actions">
            <button className="btn btn-ghost" onClick={onCancel}>
              {cancelText}
            </button>
            <button 
              className={`btn ${isDestructive ? 'btn-primary' : 'btn-primary'}`} 
              style={isDestructive ? { background: 'var(--aka)', borderColor: 'var(--aka)' } : {}}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
