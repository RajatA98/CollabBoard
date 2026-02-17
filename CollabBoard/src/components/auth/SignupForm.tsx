import { useState, type FormEvent } from 'react';

interface SignupFormProps {
  onSignup: (email: string, password: string, name: string) => void | Promise<boolean>;
  onSwitchToLogin: () => void;
  error: string | null;
}

export function SignupForm({ onSignup, onSwitchToLogin, error }: SignupFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSignup(email, password, name);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2>Sign Up</h2>
      {error && <div className="auth-error">{error}</div>}
      <div className="form-field">
        <label htmlFor="signup-name">Name</label>
        <input
          id="signup-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          required
        />
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Signing Up…' : 'Sign Up'}
      </button>
      <p className="auth-switch">
        Already have an account?{' '}
        <span onClick={onSwitchToLogin} className="auth-link">
          Log In
        </span>
      </p>
    </form>
  );
}
