import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { useAuth } from '../../hooks/useAuth';

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, loading, login, signup, loginWithGoogle, error, clearError } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
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
    const ok = await login(email, password);
    if (ok) {
      navigate('/dashboard', { replace: true });
    }
    return ok;
  };

  const handleSignup = async (email: string, password: string, displayName: string) => {
    const ok = await signup(email, password, displayName);
    if (ok) {
      navigate('/dashboard', { replace: true });
    }
    return ok;
  };

  const handleGoogleLogin = async () => {
    const ok = await loginWithGoogle();
    if (ok) {
      navigate('/dashboard', { replace: true });
    }
    return ok;
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>CollabBoard</h1>
        {isLogin ? (
          <LoginForm
            onLogin={handleLogin}
            onGoogleLogin={handleGoogleLogin}
            onSwitchToSignup={switchToSignup}
            error={error}
            message={message}
          />
        ) : (
          <SignupForm
            onSignup={handleSignup}
            onGoogleLogin={handleGoogleLogin}
            onSwitchToLogin={switchToLogin}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
