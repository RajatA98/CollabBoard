import { useState } from 'react';
import { redirectToCheckout } from '../../services/stripe';
import './UpgradeModal.css';

interface UpgradeModalProps {
  onClose: () => void;
}

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      await redirectToCheckout();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout. Please try again.';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="upgrade-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title">
      <div className="upgrade-modal-backdrop" onClick={onClose} aria-hidden />
      <div className="upgrade-modal-content">
        <div className="upgrade-modal-icon">
          <svg viewBox="0 0 24 24" fill="none" width="48" height="48">
            <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6L12 2z" fill="#7c3aed" />
          </svg>
        </div>
        <h2 id="upgrade-modal-title" className="upgrade-modal-title">
          You've used all 3 free AI commands
        </h2>
        <p className="upgrade-modal-subtitle">
          Upgrade to Pro for unlimited AI-powered whiteboard commands.
        </p>
        <ul className="upgrade-modal-benefits">
          <li>Unlimited AI commands every day</li>
          <li>Priority AI response times</li>
          <li>Full access to all AI features</li>
        </ul>
        {error && <p className="upgrade-modal-error">{error}</p>}
        <button
          className="upgrade-modal-cta"
          onClick={handleUpgrade}
          disabled={loading}
        >
          {loading ? 'Redirecting...' : 'Upgrade to Pro — $9.99/mo'}
        </button>
        <button className="upgrade-modal-dismiss" onClick={onClose}>
          Maybe Later
        </button>
      </div>
    </div>
  );
}
