import { useState, type FormEvent } from 'react';

interface LoginFormProps {
  onLogin: (email: string, password: string) => void | Promise<boolean>;
  onSwitchToSignup: () => void;
  error: string | null;
  message?: string | null;
}

export function LoginForm({ onLogin, onSwitchToSignup, error, message }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onLogin(email, password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2>Log In</h2>
      {message && <div className="auth-message">{message}</div>}
      {error && <div className="auth-error">{error}</div>}
      <div className="form-field">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          required
        />
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Logging In…' : 'Log In'}
      </button>
      <p className="auth-switch">
        Don't have an account?{' '}
        <span onClick={onSwitchToSignup} className="auth-link">
          Sign Up
        </span>
      </p>
    </form>
  );
}
