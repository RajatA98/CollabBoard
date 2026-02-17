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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSignup(email, password, name);
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
          required
        />
      </div>
      <button type="submit">Sign Up</button>
      <p className="auth-switch">
        Already have an account?{' '}
        <span onClick={onSwitchToLogin} className="auth-link">
          Log In
        </span>
      </p>
    </form>
  );
}
