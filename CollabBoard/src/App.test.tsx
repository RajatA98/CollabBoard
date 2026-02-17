import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

const mockUseAuth = vi.fn();

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('./components/auth/AuthPage', () => ({
  AuthPage: () => <div data-testid="auth-page">Auth Page</div>,
}));

vi.mock('./components/board/Board', () => ({
  Board: () => <div data-testid="board-page">Board Page</div>,
}));

function renderWithRouter(initialRoute: string) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  );
}

describe('App Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show auth page at root when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, error: null, login: vi.fn(), signup: vi.fn(), logout: vi.fn() });
    renderWithRouter('/');
    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
  });

  it('should show loading when auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, error: null, login: vi.fn(), signup: vi.fn(), logout: vi.fn() });
    renderWithRouter('/board/test');
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should redirect to auth when accessing board unauthenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, error: null, login: vi.fn(), signup: vi.fn(), logout: vi.fn() });
    renderWithRouter('/board/test');
    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
  });

  it('should show board when authenticated and navigating to board route', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: '123', email: 'test@test.com', displayName: 'Test' },
      loading: false,
      error: null,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });
    renderWithRouter('/board/test');
    expect(screen.getByTestId('board-page')).toBeInTheDocument();
  });
});
