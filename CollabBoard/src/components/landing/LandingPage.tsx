import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './LandingPage.css';

export function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <span className="landing-nav-logo">◈</span>
          CollabBoard
        </div>
        <div className="landing-nav-actions">
          <button
            className="landing-btn-outline"
            onClick={() => navigate('/auth')}
          >
            Log In
          </button>
          <button
            className="landing-btn-primary"
            onClick={() => navigate('/auth?mode=signup')}
          >
            Sign Up
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            Welcome to <span className="landing-hero-brand">CollabBoard</span>
          </h1>
          <p className="landing-hero-subtitle">
            A real-time collaborative whiteboard for teams. Draw, brainstorm, and build ideas together — from anywhere.
          </p>
          <div className="landing-hero-actions">
            <button
              className="landing-btn-primary landing-btn-large"
              onClick={() => navigate('/auth?mode=signup')}
            >
              Get Started Free
            </button>
            <button
              className="landing-btn-ghost landing-btn-large"
              onClick={() => navigate('/auth')}
            >
              Log In
            </button>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-canvas-preview">
            <div className="preview-sticky preview-sticky-1">Brainstorm ideas</div>
            <div className="preview-sticky preview-sticky-2">Real-time sync</div>
            <div className="preview-sticky preview-sticky-3">Team collaboration</div>
            <div className="preview-sticky preview-sticky-4">AI-powered tools</div>
            <svg className="preview-connector" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M80 60 Q150 100 220 60" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="6 4"/>
              <path d="M80 140 Q150 100 220 140" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="6 4"/>
            </svg>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-icon">🤝</div>
            <h3>Real-Time Collaboration</h3>
            <p>See your teammates' cursors live. Draw, move, and edit shapes together with zero lag.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">✨</div>
            <h3>AI-Powered Tools</h3>
            <p>Use natural language commands to generate diagrams, summarize content, and create sticky notes instantly.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">🔗</div>
            <h3>Easy Sharing</h3>
            <p>Share a board link and anyone on your team can join in seconds. No complex setup required.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <p>© {new Date().getFullYear()} CollabBoard. Built for teams that think visually.</p>
      </footer>
    </div>
  );
}
