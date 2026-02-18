import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Toolbar } from '../Toolbar';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderToolbar(props: { onLogout?: () => void } = {}) {
  return render(
    <MemoryRouter>
      <Toolbar {...props} />
    </MemoryRouter>
  );
}

describe('Toolbar', () => {
  it('should render the toolbar', () => {
    renderToolbar();
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('should render toolbar brand', () => {
    renderToolbar();
    expect(screen.getByText('CollabBoard')).toBeInTheDocument();
  });

  it('should navigate to dashboard when Back to boards is clicked', async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByRole('button', { name: /back to boards/i }));
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  it('should navigate to dashboard when brand is clicked', async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByRole('link', { name: /back to dashboard/i }));
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  it('should render logout button when onLogout is provided', () => {
    renderToolbar({ onLogout: vi.fn() });
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('should call onLogout when logout button is clicked', async () => {
    const user = userEvent.setup();
    const mockLogout = vi.fn();
    renderToolbar({ onLogout: mockLogout });

    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(mockLogout).toHaveBeenCalled();
  });
});
