import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { useAuth } from '../../hooks/useAuth';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login, signup, error, clearError } = useAuth();

  const switchToSignup = () => {
    setMessage(null);
    clearError();
    setIsLogin(false);
  };

  const switchToLogin = () => {
    setMessage(null);
    clearError();
    setIsLogin(true);
  };

  const handleLogin = async (email: string, password: string) => {
    const ok = await login(email, password);
    if (ok) {
      navigate('/board/default', { replace: true });
    }
  };

  const handleSignup = async (email: string, password: string, displayName: string) => {
    const ok = await signup(email, password, displayName);
    if (ok) {
      setMessage('Sign up complete. Please log in.');
      setIsLogin(true);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>CollabBoard</h1>
        {isLogin ? (
          <LoginForm
            onLogin={handleLogin}
            onSwitchToSignup={switchToSignup}
            error={error}
            message={message}
          />
        ) : (
          <SignupForm
            onSignup={handleSignup}
            onSwitchToLogin={switchToLogin}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
