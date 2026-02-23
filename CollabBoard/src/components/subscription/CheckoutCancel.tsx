import { useNavigate } from 'react-router-dom';

export function CheckoutCancel() {
  const navigate = useNavigate();

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
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>
          Checkout Cancelled
        </h2>
        <p style={{ color: '#666', fontSize: 14, margin: '0 0 24px' }}>
          No worries! You can upgrade to Pro anytime from your profile.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '10px 24px',
            background: '#fff',
            color: '#333',
            border: '1px solid #ddd',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
