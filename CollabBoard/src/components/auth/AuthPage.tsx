import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { useAuth } from '../../hooks/useAuth';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const { user, loading, login, signup, error, clearError } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/board/default" replace />;
  }

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
    await login(email, password);
  };

  const handleSignup = async (email: string, password: string, displayName: string) => {
    await signup(email, password, displayName);
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
