import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

function renderToolbar(props: { boardName?: string; onBoardNameChange?: (name: string) => void; onLogout?: () => void } = {}) {
  return render(
    <MemoryRouter>
      <Toolbar
        boardName={props.boardName ?? 'My Board'}
        onBoardNameChange={props.onBoardNameChange ?? vi.fn()}
        onLogout={props.onLogout}
      />
    </MemoryRouter>
  );
}

describe('Toolbar', () => {
  it('should render the toolbar', () => {
    renderToolbar();
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('should render board name', () => {
    renderToolbar({ boardName: 'My Board' });
    expect(screen.getByTestId('board-name')).toHaveTextContent('My Board');
  });

  it('should show Untitled when board name is blank', () => {
    renderToolbar({ boardName: 'Untitled' });
    expect(screen.getByTestId('board-name')).toHaveTextContent('Untitled');
  });

  it('should navigate to dashboard when Back to boards is clicked', async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByRole('button', { name: /back to boards/i }));
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  it('should show input when board name is clicked', async () => {
    const user = userEvent.setup();
    renderToolbar({ boardName: 'My Board' });

    await user.click(screen.getByTestId('board-name'));
    expect(screen.getByTestId('board-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('board-name-input')).toHaveValue('My Board');
  });

  it('should call onBoardNameChange when editing and blurring', async () => {
    const user = userEvent.setup();
    const onBoardNameChange = vi.fn();
    renderToolbar({ boardName: 'My Board', onBoardNameChange });

    await user.click(screen.getByTestId('board-name'));
    const input = screen.getByTestId('board-name-input');
    await user.clear(input);
    await user.type(input, 'New Name');
    await act(async () => {
      input.blur();
    });
    expect(onBoardNameChange).toHaveBeenCalledWith('New Name');
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
