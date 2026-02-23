import { useState } from 'react';
import { UsageBar } from './UsageBar';
import { redirectToCheckout, redirectToPortal } from '../../services/stripe';

interface MembershipSectionProps {
  tier: 'free' | 'pro';
  aiCommandCount: number;
  subscriptionStatus?: 'active' | 'canceling' | 'expired' | 'past_due';
  currentPeriodEnd?: number;
}

export function MembershipSection({
  tier,
  aiCommandCount,
  subscriptionStatus,
  currentPeriodEnd,
}: MembershipSectionProps) {
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    setError(null);
    try {
      await redirectToCheckout();
    } catch {
      setError('Failed to start checkout. Please try again.');
      setUpgradeLoading(false);
    }
  };

  const handleManage = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      await redirectToPortal();
    } catch {
      setError('Failed to open subscription portal. Please try again.');
      setPortalLoading(false);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="profile-membership">
      <div className="profile-section-title">Membership</div>

      <div className={`profile-tier-badge profile-tier-badge-${tier}`}>
        {tier === 'pro' ? (
          <>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ marginRight: 4 }}>
              <path d="M8 1l2 5h5l-4 3.5 1.5 5L8 11.5 3.5 14.5 5 9.5 1 6h5L8 1z" />
            </svg>
            Pro Member
          </>
        ) : (
          'Free'
        )}
      </div>

      {tier === 'free' && (
        <>
          <UsageBar used={aiCommandCount} max={3} />
          <button
            className="profile-upgrade-btn"
            onClick={handleUpgrade}
            disabled={upgradeLoading}
          >
            {upgradeLoading ? 'Redirecting...' : 'Upgrade to Pro — $9.99/mo'}
          </button>
        </>
      )}

      {tier === 'pro' && (
        <>
          {subscriptionStatus === 'active' && currentPeriodEnd && (
            <div className="profile-status-info">
              <span className="profile-status-dot profile-status-active" />
              Active — next billing date: {formatDate(currentPeriodEnd)}
            </div>
          )}
          {subscriptionStatus === 'canceling' && currentPeriodEnd && (
            <div className="profile-status-info">
              <span className="profile-status-dot profile-status-canceling" />
              Canceling — access until {formatDate(currentPeriodEnd)}
            </div>
          )}
          {subscriptionStatus === 'past_due' && (
            <div className="profile-status-info">
              <span className="profile-status-dot profile-status-past-due" />
              Past Due — please update your payment method
            </div>
          )}
          {subscriptionStatus === 'expired' && (
            <div className="profile-status-info">
              <span className="profile-status-dot profile-status-expired" />
              Expired
            </div>
          )}
          <button
            className="profile-manage-btn"
            onClick={handleManage}
            disabled={portalLoading}
          >
            {portalLoading ? 'Opening...' : 'Manage Subscription'}
          </button>
        </>
      )}

      {error && <div className="profile-feedback profile-feedback-error">{error}</div>}
    </div>
  );
}
