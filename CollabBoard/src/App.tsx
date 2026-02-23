import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './components/landing/LandingPage';
import { AuthPage } from './components/auth/AuthPage';
import { Dashboard } from './components/dashboard/Dashboard';
import { Board } from './components/board/Board';
import { BoardErrorBoundary } from './components/board/BoardErrorBoundary';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { CheckoutSuccess } from './components/subscription/CheckoutSuccess';
import { CheckoutCancel } from './components/subscription/CheckoutCancel';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/board/:boardId"
        element={
          <ProtectedRoute>
            <BoardErrorBoundary>
              <Board />
            </BoardErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkout/success"
        element={
          <ProtectedRoute>
            <CheckoutSuccess />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkout/cancel"
        element={
          <ProtectedRoute>
            <CheckoutCancel />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
