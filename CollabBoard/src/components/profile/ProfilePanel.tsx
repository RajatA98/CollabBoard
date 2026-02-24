import { useEffect, useRef } from 'react';
import { AccountInfo } from './AccountInfo';
import { MembershipSection } from './MembershipSection';
import type { AppUser } from '../../types';
import './ProfilePanel.css';

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
  user: AppUser;
  boardId?: string;
  tier: 'free' | 'pro';
  aiCommandCount: number;
  subscriptionStatus?: 'active' | 'canceling' | 'expired' | 'past_due';
  currentPeriodEnd?: number;
}

export function ProfilePanel({
  open,
  onClose,
  user,
  boardId,
  tier,
  aiCommandCount,
  subscriptionStatus,
  currentPeriodEnd,
}: ProfilePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay adding listener to avoid closing immediately on the same click that opened the panel
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open, onClose]);

  return (
    <div className={`profile-panel-overlay ${open ? 'profile-panel-open' : ''}`}>
      <div ref={panelRef} className="profile-panel" role="dialog" aria-label="Profile">
        <div className="profile-panel-header">
          <h2 className="profile-panel-title">Profile</h2>
          <button
            className="profile-panel-close"
            onClick={onClose}
            aria-label="Close profile"
          >
            &times;
          </button>
        </div>
        <div className="profile-panel-body">
          <AccountInfo user={user} boardId={boardId} />
          <hr className="profile-divider" />
          <MembershipSection
            tier={tier}
            aiCommandCount={aiCommandCount}
            subscriptionStatus={subscriptionStatus}
            currentPeriodEnd={currentPeriodEnd}
          />
        </div>
      </div>
    </div>
  );
}
