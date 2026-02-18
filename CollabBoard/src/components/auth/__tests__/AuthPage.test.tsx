import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthPage } from '../AuthPage';

const navigateMock = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to the board on successful signup', async () => {
    const user = userEvent.setup();
    const signup = vi.fn().mockResolvedValue(true);

    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      error: null,
      clearError: vi.fn(),
      login: vi.fn().mockResolvedValue(false),
      signup,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await user.click(screen.getByText(/sign up/i));

    await user.type(screen.getByLabelText(/name/i), 'Test User');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(signup).toHaveBeenCalledWith('test@test.com', 'password123', 'Test User');
      expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('navigates to the board on successful login', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue(true);

    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      error: null,
      clearError: vi.fn(),
      login,
      signup: vi.fn().mockResolvedValue(false),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('test@test.com', 'password123');
      expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('redirects to the board when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: '123', email: 'test@test.com', displayName: 'Test' },
      loading: false,
      error: null,
      clearError: vi.fn(),
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthPage />
      </MemoryRouter>
    );

    expect(screen.queryByRole('heading', { name: /log in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /sign up/i })).not.toBeInTheDocument();
  });

  it('shows loading state while auth is initializing', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      error: null,
      clearError: vi.fn(),
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /log in/i })).not.toBeInTheDocument();
  });
});
