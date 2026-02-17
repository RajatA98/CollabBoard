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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
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
          required
        />
      </div>
      <button type="submit">Log In</button>
      <p className="auth-switch">
        Don't have an account?{' '}
        <span onClick={onSwitchToSignup} className="auth-link">
          Sign Up
        </span>
      </p>
    </form>
  );
}
