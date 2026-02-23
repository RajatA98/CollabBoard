import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { onUserDocChange } from '../../firebase/users';
import './UpgradeModal.css';

export function CheckoutSuccess() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onUserDocChange(user.uid, (data) => {
      if (data?.subscriptionTier === 'pro') {
        setConfirmed(true);
      }
    });

    // Auto-redirect after 8 seconds even if webhook hasn't fired yet
    const timeout = setTimeout(() => {
      navigate('/dashboard');
    }, 8000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [user, navigate]);

  useEffect(() => {
    if (confirmed) {
      const timeout = setTimeout(() => navigate('/dashboard'), 3000);
      return () => clearTimeout(timeout);
    }
  }, [confirmed, navigate]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#f5f6fa',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '48px 40px',
        maxWidth: 420,
        width: '90%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        textAlign: 'center',
      }}>
        {confirmed ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>
              Welcome to CollabBoard Pro!
            </h2>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 24px' }}>
              Your subscription is active. Enjoy unlimited AI commands.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #7c3aed 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Go to Dashboard
            </button>
          </>
        ) : (
          <>
            <div className="checkout-spinner" style={{
              width: 40,
              height: 40,
              border: '3px solid #e0e0e0',
              borderTopColor: '#7c3aed',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>
              Processing your subscription...
            </h2>
            <p style={{ color: '#666', fontSize: 14, margin: 0 }}>
              This usually takes a few seconds. You'll be redirected automatically.
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}
      </div>
    </div>
  );
}
